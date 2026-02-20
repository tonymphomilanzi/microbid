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

// -----------------------------
// Month key + plan features
// -----------------------------
function monthKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// Get start and end dates for a month key (UTC)
function getMonthDateRange(mk) {
  const [year, month] = mk.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));

  // Next month
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const end = new Date(Date.UTC(nextYear, nextMonth - 1, 1, 0, 0, 0, 0));

  return { start, end };
}

function normalizeFeatures(features) {
  const f = features && typeof features === "object" ? features : {};
  const listingsPerMonth = Number(f.listingsPerMonth ?? 0);
  const conversationsPerMonth = Number(f.conversationsPerMonth ?? 0);
  return {
    listingsPerMonth: Number.isFinite(listingsPerMonth) ? Math.trunc(listingsPerMonth) : 0,
    conversationsPerMonth: Number.isFinite(conversationsPerMonth) ? Math.trunc(conversationsPerMonth) : 0,
  };
}

async function getEffectiveFeaturesForUser(tx, userId, userTier, userRole) {
  if (userRole === "ADMIN") {
    return { listingsPerMonth: -1, conversationsPerMonth: -1 };
  }

  const sub = await tx.userSubscription.findUnique({
    where: { userId },
    include: { plan: true },
  });

  if (sub?.status === "ACTIVE" && sub.plan) {
    return normalizeFeatures(sub.plan.features);
  }

  const tierName = String(userTier || "FREE").toUpperCase();
  const byTier = await tx.plan.findUnique({ where: { name: tierName } });
  if (byTier) return normalizeFeatures(byTier.features);

  const free = await tx.plan.findUnique({ where: { name: "FREE" } });
  if (free) return normalizeFeatures(free.features);

  return { listingsPerMonth: 0, conversationsPerMonth: 0 };
}

/**
 * Check if user can start a new conversation based on REAL count from database
 * This includes historical conversations created before tracking was implemented
 */
async function checkConversationsLimitOrThrow(tx, userId, mk, limit) {
  // unlimited if < 0
  if (typeof limit === "number" && limit < 0) return;

  if (!Number.isFinite(limit) || limit <= 0) {
    const err = new Error("Monthly conversation limit reached. Upgrade to start more new conversations.");
    err.statusCode = 403;
    throw err;
  }

  const { start, end } = getMonthDateRange(mk);

  // Count actual conversations started by this user (as buyer) this month
  const currentCount = await tx.conversation.count({
    where: {
      buyerId: userId,
      createdAt: { gte: start, lt: end },
    },
  });

  if (currentCount >= limit) {
    const err = new Error(`Monthly conversation limit reached (${currentCount}/${limit}). Upgrade to start more new conversations.`);
    err.statusCode = 403;
    throw err;
  }
}

// Advisory lock helper
async function advisoryLock(tx, lockKey) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
}

// -----------------------------
// Handler
// -----------------------------
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
          buyer: { select: { id: true, username: true } },
          seller: { select: { id: true, username: true } },
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

      // Create conversation + enforce monthly new conversation limit (only if NEW)
      const result = await prisma.$transaction(async (tx) => {
        const mk = monthKey();

        // lock around check+create to reduce races
        await advisoryLock(tx, `usage:conversations:${uid}:${mk}`);

        // Check if it already exists (do NOT check limit if exists)
        const existing = await tx.conversation.findUnique({
          where: {
            listingId_buyerId_sellerId: {
              listingId,
              buyerId: uid,
              sellerId: listing.sellerId,
            },
          },
        });

        let conversation;
        if (existing) {
          conversation = existing;
        } else {
          // Check limit before creating (based on real count including historical data)
          const me = await tx.user.findUnique({ where: { id: uid }, select: { id: true, role: true, tier: true } });
          const features = await getEffectiveFeaturesForUser(tx, uid, me?.tier, me?.role);

          if (me?.role !== "ADMIN") {
            await checkConversationsLimitOrThrow(tx, uid, mk, features.conversationsPerMonth);
          }

          // Create conversation
          conversation = await tx.conversation.create({
            data: { listingId, buyerId: uid, sellerId: listing.sellerId },
          });
        }

        const message = await tx.message.create({
          data: { conversationId: conversation.id, senderId: uid, text },
        });

        // bump ordering + unread for seller
        await tx.conversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: new Date(),
            sellerUnread: { increment: 1 },
          },
        });

        return { conversationId: conversation.id, message };
      });

      return res.status(201).json(result);
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ message: "Method not allowed" });
  } catch (e) {
    return res.status(e.statusCode ?? 500).json({ message: e.message ?? "Error" });
  }
}