import { prisma } from "../_lib/prisma.js";
import { requireAuth } from "../_lib/auth.js";

function readJson(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === "object") return b;
  if (Buffer.isBuffer(b)) return JSON.parse(b.toString("utf8"));
  if (typeof b === "string") return JSON.parse(b);
  return {};
}

export default async function handler(req, res) {
  try {
    const decoded = await requireAuth(req);
    const uid = decoded.uid;

    const rawId = req.query?.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id) return res.status(400).json({ message: "Missing conversation id" });

    if (req.method === "GET") {
      const convo = await prisma.conversation.findUnique({
        where: { id },
        include: {
          listing: { select: { id: true, title: true, image: true, platform: true } },
          buyer: { select: { id: true, email: true } },
          seller: { select: { id: true, email: true } },
          messages: { orderBy: { createdAt: "asc" }, take: 400 },
        },
      });

      if (!convo) return res.status(404).json({ message: "Conversation not found" });

      const isParticipant = convo.buyerId === uid || convo.sellerId === uid;
      if (!isParticipant) return res.status(403).json({ message: "Forbidden" });

      return res.status(200).json({ conversation: convo });
    }

    if (req.method === "POST") {
      const body = readJson(req);
      const text = body.text?.trim();
      if (!text) return res.status(400).json({ message: "Missing text" });

      const convo = await prisma.conversation.findUnique({ where: { id } });
      if (!convo) return res.status(404).json({ message: "Conversation not found" });

      const isParticipant = convo.buyerId === uid || convo.sellerId === uid;
      if (!isParticipant) return res.status(403).json({ message: "Forbidden" });

      await prisma.user.upsert({
        where: { id: uid },
        update: { email: decoded.email ?? "unknown" },
        create: { id: uid, email: decoded.email ?? "unknown" },
      });

      const message = await prisma.message.create({
        data: {
          conversationId: id,
          senderId: uid,
          text,
        },
      });

      await prisma.conversation.update({
        where: { id },
        data: {},
      });

      return res.status(201).json({ message });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ message: "Method not allowed" });
  } catch (e) {
    return res.status(e.statusCode ?? 500).json({ message: e.message ?? "Error" });
  }
}