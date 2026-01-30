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

    // ---------- GET ----------
    if (req.method === "GET") {
      const rawListingId = req.query?.listingId;
      const listingId = Array.isArray(rawListingId) ? rawListingId[0] : rawListingId;

      // buyer fetch convo by listingId
      if (listingId) {
        const listing = await prisma.listing.findUnique({
          where: { id: listingId },
          include: { seller: { select: { id: true, email: true } } },
        });
        if (!listing) return res.status(404).json({ message: "Listing not found" });

        if (listing.sellerId === uid) {
          return res.status(400).json({ message: "You cannot message your own listing." });
        }

        const conversation = await prisma.conversation.findUnique({
          where: {
            listingId_buyerId_sellerId: {
              listingId,
              buyerId: uid,
              sellerId: listing.sellerId,
            },
          },
          include: {
            listing: { select: { id: true, title: true, image: true, platform: true } },
            buyer: { select: { id: true, email: true } },
            seller: { select: { id: true, email: true } },
            messages: { orderBy: { createdAt: "asc" }, take: 200 },
          },
        });

        return res.status(200).json({ conversation: conversation ?? null });
      }

      // list all my conversations
      const conversations = await prisma.conversation.findMany({
        where: { OR: [{ buyerId: uid }, { sellerId: uid }] },
        orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
        include: {
          listing: { select: { id: true, title: true, image: true, platform: true } },
          buyer: { select: { id: true, email: true } },
          seller: { select: { id: true, email: true } },
          messages: { orderBy: { createdAt: "desc" }, take: 1 }, // last message preview
        },
      });

      // Add unreadCount specific to current user
      const enriched = conversations.map((c) => ({
        ...c,
        unreadCount: c.buyerId === uid ? c.buyerUnread : c.sellerUnread,
      }));

      return res.status(200).json({ conversations: enriched });
    }

    // ---------- POST ----------
    // buyer sends message to seller from listing page (creates conversation if needed)
    if (req.method === "POST") {
      const body = readJson(req);
      const listingId = body.listingId;
      const text = body.text?.trim();

      if (!listingId || !text) {
        return res.status(400).json({ message: "Missing listingId or text" });
      }

      const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        include: { seller: { select: { id: true, email: true } } },
      });

      if (!listing) return res.status(404).json({ message: "Listing not found" });
      if (listing.sellerId === uid) {
        return res.status(400).json({ message: "You cannot message your own listing." });
      }

      // Ensure users exist
      await prisma.user.upsert({
        where: { id: uid },
        update: { email: decoded.email ?? "unknown" },
        create: { id: uid, email: decoded.email ?? "unknown" },
      });

      await prisma.user.upsert({
        where: { id: listing.sellerId },
        update: {},
        create: { id: listing.sellerId, email: listing.seller?.email ?? "unknown" },
      });

      const conversation = await prisma.conversation.upsert({
        where: {
          listingId_buyerId_sellerId: {
            listingId,
            buyerId: uid,
            sellerId: listing.sellerId,
          },
        },
        update: {},
        create: { listingId, buyerId: uid, sellerId: listing.sellerId },
      });

      const message = await prisma.message.create({
        data: { conversationId: conversation.id, senderId: uid, text },
      });

      // bump ordering + unread for seller
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          sellerUnread: { increment: 1 },
        },
      });

      return res.status(201).json({ conversationId: conversation.id, message });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ message: "Method not allowed" });
  } catch (e) {
    return res.status(e.statusCode ?? 500).json({ message: e.message ?? "Error" });
  }
}