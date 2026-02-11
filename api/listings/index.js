import { prisma } from "../_lib/prisma.js";
import { requireAuth } from "../_lib/auth.js";
import { getStripe } from "../_lib/stripe.js";

function readJson(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === "object") return b;
  if (Buffer.isBuffer(b)) return JSON.parse(b.toString("utf8"));
  if (typeof b === "string") return JSON.parse(b);
  return {};
}

async function optionalAuthUid(req) {
  try {
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) return null;
    const decoded = await requireAuth(req);
    return decoded?.uid || null;
  } catch {
    return null;
  }
}

function toNumberOrUndefined(v) {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function cleanImageList(arr) {
  const list = Array.isArray(arr) ? arr : [];
  const cleaned = list
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);

  // remove duplicates while preserving order
  const seen = new Set();
  const uniq = [];
  for (const u of cleaned) {
    if (!seen.has(u)) {
      seen.add(u);
      uniq.push(u);
    }
  }
  return uniq;
}

export default async function handler(req, res) {
  try {
    // -------------------------
    // GET /api/listings?public=listingComments&listingId=...
    // -------------------------


    
    if (req.method === "GET" && req.query?.public === "listingComments") {
      const listingId = String(req.query?.listingId || "");
      if (!listingId) return res.status(400).json({ message: "listingId is required" });

      const comments = await prisma.listingComment.findMany({
        where: { listingId },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          author: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              lastActiveAt: true,
              isVerified: true,
              tier: true,
            },
          },
        },
      });

      const commentCount = await prisma.listingComment.count({ where: { listingId } });

      return res.status(200).json({ comments, commentCount });
    }


    // GET /api/listings?public=listingBids&listingId=...

if (req.method === "GET" && req.query?.public === "listingBids") {
  const listingId = String(req.query?.listingId || "");
  if (!listingId) return res.status(400).json({ message: "listingId is required" });

  const bids = await prisma.listingBid.findMany({
    where: { listingId },
    orderBy: [{ amount: "desc" }, { createdAt: "desc" }], //  stable ordering
    take: 50,
    include: {
      bidder: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          lastActiveAt: true,
          tier: true,
          isVerified: true,
        },
      },
    },
  });

  const agg = await prisma.listingBid.aggregate({
    where: { listingId },
    _max: { amount: true },
    _count: { _all: true }, //  correct
  });

  const highestBid = agg._max?.amount ?? 0;
  const bidCount = agg._count?._all ?? 0;

  return res.status(200).json({
    bids,
    bidCount,
    highestBid,
    minNextBid: highestBid + 1, // optional but useful for UI
  });
}

    // -------------------------
    // GET /api/listings (public)
    // -------------------------
    if (req.method === "GET") {
      const { platform, categoryId, q, minPrice, maxPrice } = req.query;

      const minP = toNumberOrUndefined(minPrice);
      const maxP = toNumberOrUndefined(maxPrice);

      const where = {
        status: "ACTIVE",
        ...(platform ? { platform } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(minP !== undefined || maxP !== undefined
          ? {
              price: {
                ...(minP !== undefined ? { gte: minP } : {}),
                ...(maxP !== undefined ? { lte: maxP } : {}),
              },
            }
          : {}),
      };

      const uid = await optionalAuthUid(req); // may be null (public)

      const listingsRaw = await prisma.listing.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          seller: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              lastActiveAt: true,
              isVerified: true,
              tier: true,
            },
          },
          category: true,

          // ✅ include views
          _count: { select: { likes: true, comments: true, views: true } },

          ...(uid ? { likes: { where: { userId: uid }, select: { id: true } } } : {}),
        },
      });

      const listings = listingsRaw.map((l) => {
        const { _count, likes, ...rest } = l;
        return {
          ...rest,
          likeCount: _count?.likes ?? 0,
          commentCount: _count?.comments ?? 0,
          viewCount: _count?.views ?? 0, // ✅
          likedByMe: uid ? (likes?.length ?? 0) > 0 : false,
        };
      });

      return res.status(200).json({ listings });
    }

    // --------------------------
    // POST /api/listings (auth)
    // --------------------------
    if (req.method === "POST") {
      const decoded = await requireAuth(req);
      const body = readJson(req);


if (body.intent === "addListingBid") {
  const listingId = String(body.listingId || "");
  const amount = Number(body.amount);

  if (!listingId) return res.status(400).json({ message: "Missing listingId" });
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ message: "Invalid bid amount" });
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, sellerId: true, status: true, price: true },
  });

  if (!listing || listing.status !== "ACTIVE") {
    return res.status(404).json({ message: "Listing not available" });
  }

  if (listing.sellerId === decoded.uid) {
    return res.status(403).json({ message: "You cannot bid on your own listing." });
  }

  const result = await prisma.$transaction(async (tx) => {
    const top = await tx.listingBid.findFirst({
      where: { listingId },
      orderBy: [{ amount: "desc" }, { createdAt: "desc" }],
      select: { amount: true },
    });

    const highest = top?.amount ?? 0;

    // ✅ must be greater than BOTH listing.price and highest bid
    const minAllowed = Math.max(listing.price, highest) + 1;

    if (amount < minAllowed) {
      const err = new Error(`Bid must be at least $${minAllowed}.`);
      err.statusCode = 400;
      throw err;
    }

    const bid = await tx.listingBid.create({
      data: { listingId, bidderId: decoded.uid, amount },
      include: {
        bidder: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            lastActiveAt: true,
            isVerified: true,
            tier: true,
          },
        },
      },
    });

    const agg = await tx.listingBid.aggregate({
      where: { listingId },
      _max: { amount: true },
      _count: { _all: true }, //  correct
    });

    const highestBid = agg._max?.amount ?? amount;
    const bidCount = agg._count?._all ?? 1;

    return {
      bid,
      highestBid,
      bidCount,
      minNextBid: highestBid + 1,
    };
  });

  return res.status(201).json(result);
}
      // Intent: toggle like
      if (body.intent === "toggleListingLike") {
        const listingId = String(body.listingId || "");
        if (!listingId) return res.status(400).json({ message: "Missing listingId" });

        const where = { listingId_userId: { listingId, userId: decoded.uid } };
        const existing = await prisma.listingLike.findUnique({ where });

        if (existing) await prisma.listingLike.delete({ where });
        else await prisma.listingLike.create({ data: { listingId, userId: decoded.uid } });

        const counts = await prisma.listing.findUnique({
          where: { id: listingId },
          select: { _count: { select: { likes: true, comments: true, views: true } } },
        });

        return res.status(200).json({
          liked: !existing,
          likeCount: counts?._count?.likes ?? 0,
          commentCount: counts?._count?.comments ?? 0,
          viewCount: counts?._count?.views ?? 0, // ✅
        });
      }

      // Intent: add comment
      if (body.intent === "addListingComment") {
        const listingId = String(body.listingId || "");
        const text = String(body.body || "").trim();

        if (!listingId) return res.status(400).json({ message: "Missing listingId" });
        if (!text) return res.status(400).json({ message: "Comment cannot be empty" });
        if (text.length > 2000) return res.status(400).json({ message: "Comment too long (max 2000 chars)" });

        const comment = await prisma.listingComment.create({
          data: { listingId, authorId: decoded.uid, body: text },
          include: {
            author: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
                lastActiveAt: true,
                isVerified: true,
                tier: true,
              },
            },
          },
        });

        const counts = await prisma.listing.findUnique({
          where: { id: listingId },
          select: { _count: { select: { likes: true, comments: true, views: true } } },
        });

        return res.status(201).json({
          comment,
          likeCount: counts?._count?.likes ?? 0,
          commentCount: counts?._count?.comments ?? 0,
          viewCount: counts?._count?.views ?? 0, // ✅
        });
      }

      // Intent: Stripe checkout
      if (body.intent === "checkout") {
        const listingId = body.listingId;
        if (!listingId) return res.status(400).json({ message: "Missing listingId" });

        const listing = await prisma.listing.findUnique({
          where: { id: listingId },
          include: { seller: true },
        });

        if (!listing || listing.status !== "ACTIVE") {
          return res.status(404).json({ message: "Listing not available" });
        }

        const stripe = getStripe();

        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          success_url: process.env.STRIPE_SUCCESS_URL,
          cancel_url: process.env.STRIPE_CANCEL_URL,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: listing.price * 100,
                product_data: {
                  name: listing.title,
                  images: listing.image ? [listing.image] : [],
                },
              },
            },
          ],
          metadata: {
            listingId: listing.id,
            buyerId: decoded.uid,
            sellerId: listing.sellerId,
          },
        });

        await prisma.purchase.create({
          data: {
            listingId: listing.id,
            buyerId: decoded.uid,
            sellerId: listing.sellerId,
            amount: listing.price,
            stripeSessionId: session.id,
          },
        });

        return res.status(200).json({ checkoutUrl: session.url });
      }

      // Create / Update listing
      const {
        id,
        title,
        platform,
        categoryId,
        price,
        description,
        image,
        images,
        metrics,
        status,
      } = body;

      const numericPrice = Number(price);

      if (!title || !platform || !description || !Number.isFinite(numericPrice) || numericPrice <= 0) {
        return res.status(400).json({ message: "Missing/invalid required fields" });
      }

      // Ensure user exists + get role (for admin-only categories)
      const dbUser = await prisma.user.upsert({
        where: { id: decoded.uid },
        update: { email: decoded.email ?? "unknown" },
        create: { id: decoded.uid, email: decoded.email ?? "unknown" },
        select: { id: true, role: true },
      });

      // Validate platform
      const platformRow = await prisma.platform.findFirst({
        where: { name: platform, isActive: true },
        select: { id: true },
      });

      if (!platformRow) {
        return res.status(400).json({ message: "Invalid or inactive platform" });
      }

      // Validate category + enforce admin-only
      let categoryToSet = null;
      if (categoryId) {
        const cat = await prisma.category.findUnique({
          where: { id: categoryId },
          select: { id: true, isActive: true, isAdminOnly: true },
        });

        if (!cat || !cat.isActive) return res.status(400).json({ message: "Invalid category" });
        if (cat.isAdminOnly && dbUser.role !== "ADMIN") {
          return res.status(403).json({ message: "This category is admin-only" });
        }
        categoryToSet = cat.id;
      }

      // Build final image gallery (max 6)
      const extraImages = cleanImageList(images);
      const cover = typeof image === "string" && image.trim() ? image.trim() : extraImages[0];

      if (!cover) {
        return res.status(400).json({ message: "Missing cover image" });
      }

      const finalImages = cleanImageList([cover, ...extraImages]).slice(0, 6);

      if (finalImages.length === 0) {
        return res.status(400).json({ message: "Missing images" });
      }

      // Update
      if (id) {
        const existing = await prisma.listing.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ message: "Listing not found" });
        if (existing.sellerId !== decoded.uid) return res.status(403).json({ message: "Forbidden" });

        const updated = await prisma.listing.update({
          where: { id },
          data: {
            title,
            platform,
            categoryId: categoryToSet,
            price: numericPrice,
            description,
            image: finalImages[0],
            images: finalImages,
            metrics: metrics ?? undefined,
            status: status ?? undefined,
          },
          include: {
            seller: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
                lastActiveAt: true,
                isVerified: true,
                tier: true,
              },
            },
            category: true,
          },
        });

        return res.status(200).json({ listing: updated });
      }

      // Create
      const created = await prisma.listing.create({
        data: {
          title,
          platform,
          categoryId: categoryToSet,
          price: numericPrice,
          description,
          image: finalImages[0],
          images: finalImages,
          metrics: metrics ?? null,
          sellerId: decoded.uid,
        },
        include: {
          seller: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              lastActiveAt: true,
              isVerified: true,
              tier: true,
            },
          },
          category: true,
        },
      });

      return res.status(201).json({ listing: created });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ message: "Method not allowed" });
  } catch (e) {
    return res.status(e.statusCode ?? 500).json({ message: e.message ?? "Error" });
  }
}