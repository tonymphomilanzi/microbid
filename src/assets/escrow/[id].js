import { prisma } from "../../../api/_lib/prisma.js";
import { requireAuth } from "../../../api/_lib/auth.js";

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
    if (!id) return res.status(400).json({ message: "Missing escrow id" });

    const escrow = await prisma.escrowTransaction.findUnique({
      where: { id },
      include: {
        listing: { select: { id: true, title: true, platform: true, image: true } },
      },
    });

    if (!escrow) return res.status(404).json({ message: "Escrow not found" });
    const isParty = escrow.buyerId === uid || escrow.sellerId === uid;
    if (!isParty) return res.status(403).json({ message: "Forbidden" });

    if (req.method === "GET") {
      return res.status(200).json({ escrow });
    }

    if (req.method === "POST") {
      const body = readJson(req);
      const action = body.action;

      if (action === "markReceived") {
        if (escrow.buyerId !== uid) return res.status(403).json({ message: "Buyer only" });
        if (escrow.status !== "TRANSFERRED_TO_BUYER") {
          return res.status(400).json({ message: "Cannot release before transfer to buyer" });
        }

        const updated = await prisma.escrowTransaction.update({
          where: { id },
          data: { status: "RELEASED", releasedAt: new Date() },
        });

        return res.status(200).json({ escrow: updated });
      }

      return res.status(400).json({ message: "Unknown action" });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ message: "Method not allowed" });
  } catch (e) {
    return res.status(e.statusCode ?? 500).json({ message: e.message ?? "Error" });
  }
}