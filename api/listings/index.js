// /api/listings/index.js
// -----------------------------------------------------------------------------
// What this file does (routes):
//   GET  /api/listings
//   GET  /api/listings?public=listingComments&listingId=...
//   GET  /api/listings?public=listingBids&listingId=...
//   POST /api/listings  (intents)
//     - toggleListingLike
//     - addListingComment
//     - addListingBid
//     - checkout (Stripe)
//     - create/update listing (default when no intent)
//
// Improvements added (without breaking response shapes your UI expects):
//   income/expense support for listings (create + update)
//   best-effort rate limiting (in-memory; works per warm lambda instance)
//   race-condition reduction using Postgres advisory locks
//   best-effort idempotency (header/body key + dedupe windows for bids/comments/checkout)
// -----------------------------------------------------------------------------

import { prisma } from "../_lib/prisma.js";
import { requireAuth } from "../_lib/auth.js";
import { getStripe } from "../_lib/stripe.js";

// -----------------------------
// Small utilities
// -----------------------------

function send(res, status, json) {
  return res.status(status).json(json);
}

function getClientIp(req) {
  // Vercel/Proxy typical headers
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) return xff.split(",")[0].trim();
  if (Array.isArray(xff) && xff[0]) return String(xff[0]).trim();
  return (
    req.headers["x-real-ip"] ||
    req.headers["cf-connecting-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

function readJson(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === "object") return b;
  if (Buffer.isBuffer(b)) return safeJsonParse(b.toString("utf8"));
  if (typeof b === "string") return safeJsonParse(b);
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

function toNonNegativeIntOrNullOrUndefined(v) {
  // undefined => don't touch (useful for "update only when provided")
  if (v === undefined) return undefined;

  // null/"" => explicitly clear (set to null)
  if (v === null || v === "") return null;

  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;

  const int = Math.trunc(n);
  if (int < 0) return undefined;

  return int;
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

function getIdempotencyKey(req, body) {
  // Standard-ish places
  const headerKey =
    req.headers["idempotency-key"] ||
    req.headers["x-idempotency-key"] ||
    req.headers["Idempotency-Key"];

  const k = (typeof headerKey === "string" && headerKey.trim()) || body?.idempotencyKey;
  return typeof k === "string" && k.trim() ? k.trim() : null;
}

// -----------------------------
// Best-effort rate limiter (in-memory)
// NOTE: Serverless instances scale horizontally, so this is not global.
// It still helps a lot against accidental spam and UI double-click bursts.
// -----------------------------
const RL_BUCKETS = new Map(); // key -> { count, resetAt }
function rateLimit({ key, limit, windowMs }) {
  const now = Date.now();
  const cur = RL_BUCKETS.get(key);

  if (!cur || now > cur.resetAt) {
    RL_BUCKETS.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (cur.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: cur.resetAt };
  }

  cur.count += 1;
  return { allowed: true, remaining: Math.max(0, limit - cur.count), resetAt: cur.resetAt };
}

function checkRateLimitOr429(req, res, { scope, limit, windowMs }) {
  const ip = getClientIp(req);
  const key = `rl:${scope}:${ip}`;
  const r = rateLimit({ key, limit, windowMs });

  if (!r.allowed) {
    // Keep response simple; clients typically display "Try again".
    res.setHeader("Retry-After", String(Math.ceil((r.resetAt - Date.now()) / 1000)));
    send(res, 429, { message: "Too many requests. Please slow down." });
    return false;
  }
  return true;
}

// -----------------------------
// Best-effort idempotency cache (in-memory)
// Used for retry/double submit protection.
// -----------------------------
const IDEM = new Map(); // key -> { expiresAt, status, body }
function getCachedIdem(key) {
  const v = IDEM.get(key);
  if (!v) return null;
  if (Date.now() > v.expiresAt) {
    IDEM.delete(key);
    return null;
  }
  return v;
}
function setCachedIdem(key, status, body, ttlMs = 2 * 60 * 1000) {
  IDEM.set(key, { expiresAt: Date.now() + ttlMs, status, body });
}

// -----------------------------
// Advisory locks (race condition reduction)
// Uses Postgres hashtextextended -> bigint to lock within the current TX.
// -----------------------------
async function advisoryLock(tx, lockKey) {
  // Requires PostgreSQL (Neon supports this)
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
}

// -----------------------------
// Main handler
// -----------------------------
export default async function handler(req, res) {
  try {
    // -------------------------------------------------------------------------
    // PUBLIC GET: listing comments
    // GET /api/listings?public=listingComments&listingId=...
    // -------------------------------------------------------------------------
    if (req.method === "GET" && req.query?.public === "listingComments") {
      if (!checkRateLimitOr429(req, res, { scope: "get:listingComments", limit: 60, windowMs: 60_000 }))
        return;

      const listingId = String(req.query?.listingId || "");
      if (!listingId) return send(res, 400, { message: "listingId is required" });

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

      return send(res, 200, { comments, commentCount });
    }

    // -------------------------------------------------------------------------
    // PUBLIC GET: listing bids
    // GET /api/listings?public=listingBids&listingId=...
    // -------------------------------------------------------------------------
    if (req.method === "GET" && req.query?.public === "listingBids") {
      if (!checkRateLimitOr429(req, res, { scope: "get:listingBids", limit: 60, windowMs: 60_000 }))
        return;

      const listingId = String(req.query?.listingId || "");
      if (!listingId) return send(res, 400, { message: "listingId is required" });

      const bids = await prisma.listingBid.findMany({
        where: { listingId },
        orderBy: [{ amount: "desc" }, { createdAt: "desc" }], // stable ordering
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
        _count: { _all: true },
      });

      const highestBid = agg._max?.amount ?? 0;
      const bidCount = agg._count?._all ?? 0;

      return send(res, 200, {
        bids,
        bidCount,
        highestBid,
        minNextBid: highestBid + 1, // optional (your UI ignores/uses it safely)
      });
    }

    // -------------------------------------------------------------------------
    // PUBLIC GET: list listings
    // GET /api/listings
    // -------------------------------------------------------------------------
    if (req.method === "GET") {
      if (!checkRateLimitOr429(req, res, { scope: "get:listings", limit: 120, windowMs: 60_000 }))
        return;

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
          _count: { select: { likes: true, comments: true, views: true } },
          ...(uid ? { likes: { where: { userId: uid }, select: { id: true } } } : {}),
        },
      });

      // Keep exactly the same mapping (plus listing will now naturally contain income/expense)
      const listings = listingsRaw.map((l) => {
        const { _count, likes, ...rest } = l;
        return {
          ...rest,
          likeCount: _count?.likes ?? 0,
          commentCount: _count?.comments ?? 0,
          viewCount: _count?.views ?? 0,
          likedByMe: uid ? (likes?.length ?? 0) > 0 : false,
        };
      });

      return send(res, 200, { listings });
    }

    // -------------------------------------------------------------------------
    // AUTH POST: intents + create/update
    // POST /api/listings
    // -------------------------------------------------------------------------
    if (req.method === "POST") {
      // rate limit POST generally (before auth to avoid expensive verification loops)
      if (!checkRateLimitOr429(req, res, { scope: "post:listings", limit: 120, windowMs: 60_000 }))
        return;

      const body = readJson(req);
      const intent = body.intent || "upsertListing";

      // For intents that often get retried, support best-effort idempotency
      // Keyed by ip+intent+idemKey (and later by uid once auth is decoded)
      const preIdemKey = getIdempotencyKey(req, body);
      if (preIdemKey && ["addListingBid", "addListingComment", "checkout"].includes(intent)) {
        const ip = getClientIp(req);
        const cacheKey = `idem:${intent}:${ip}:${preIdemKey}`;
        const cached = getCachedIdem(cacheKey);
        if (cached) return send(res, cached.status, cached.body);
      }

      const decoded = await requireAuth(req);

      // Once we have uid, prefer uid-scoped idempotency (better)
      const idemKey = getIdempotencyKey(req, body);
      const userScopedIdemKey =
        idemKey && ["addListingBid", "addListingComment", "checkout"].includes(intent)
          ? `idem:${intent}:u:${decoded.uid}:${idemKey}`
          : null;

      if (userScopedIdemKey) {
        const cached = getCachedIdem(userScopedIdemKey);
        if (cached) return send(res, cached.status, cached.body);
      }

      // -----------------------------------------------------------------------
      // Intent: addListingBid (race-safe + idempotent-ish)
      // -----------------------------------------------------------------------
      if (intent === "addListingBid") {
        if (!checkRateLimitOr429(req, res, { scope: "post:addListingBid", limit: 20, windowMs: 60_000 }))
          return;

        const listingId = String(body.listingId || "");
        const amount = Number(body.amount);

        if (!listingId) return send(res, 400, { message: "Missing listingId" });
        if (!Number.isFinite(amount) || amount <= 0) {
          return send(res, 400, { message: "Invalid bid amount" });
        }

        const listing = await prisma.listing.findUnique({
          where: { id: listingId },
          select: { id: true, sellerId: true, status: true, price: true },
        });

        if (!listing || listing.status !== "ACTIVE") {
          return send(res, 404, { message: "Listing not available" });
        }

        if (listing.sellerId === decoded.uid) {
          return send(res, 403, { message: "You cannot bid on your own listing." });
        }

        const result = await prisma.$transaction(async (tx) => {
          // Serialize bid writes per listing to reduce race conditions
          await advisoryLock(tx, `bid:${listingId}`);

          // Idempotency-ish: if same bidder placed same amount very recently, return it
          // (helps with client retries / double-click)
          const recentSame = await tx.listingBid.findFirst({
            where: {
              listingId,
              bidderId: decoded.uid,
              amount: Math.trunc(amount),
              createdAt: { gte: new Date(Date.now() - 30_000) }, // 30 seconds window
            },
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

          if (recentSame) {
            const agg = await tx.listingBid.aggregate({
              where: { listingId },
              _max: { amount: true },
              _count: { _all: true },
            });

            const highestBid = agg._max?.amount ?? recentSame.amount;
            const bidCount = agg._count?._all ?? 1;

            return { bid: recentSame, highestBid, bidCount, minNextBid: highestBid + 1 };
          }

          const top = await tx.listingBid.findFirst({
            where: { listingId },
            orderBy: [{ amount: "desc" }, { createdAt: "desc" }],
            select: { amount: true },
          });

          const highest = top?.amount ?? 0;
          const minAllowed = Math.max(listing.price, highest) + 1;

          if (amount < minAllowed) {
            const err = new Error(`Bid must be at least $${minAllowed}.`);
            err.statusCode = 400;
            throw err;
          }

          const bid = await tx.listingBid.create({
            data: { listingId, bidderId: decoded.uid, amount: Math.trunc(amount) },
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
            _count: { _all: true },
          });

          const highestBid = agg._max?.amount ?? bid.amount;
          const bidCount = agg._count?._all ?? 1;

          return { bid, highestBid, bidCount, minNextBid: highestBid + 1 };
        });

        // Store idempotency cache (best-effort)
        if (userScopedIdemKey) setCachedIdem(userScopedIdemKey, 201, result, 2 * 60_000);

        return send(res, 201, result);
      }

      // -----------------------------------------------------------------------
      // Intent: toggleListingLike (race-safe)
      // -----------------------------------------------------------------------
      if (intent === "toggleListingLike") {
        if (!checkRateLimitOr429(req, res, { scope: "post:toggleListingLike", limit: 120, windowMs: 60_000 }))
          return;

        const listingId = String(body.listingId || "");
        if (!listingId) return send(res, 400, { message: "Missing listingId" });

        const where = { listingId_userId: { listingId, userId: decoded.uid } };

        // Make toggle safer under concurrency using advisory lock per (listing,user)
        const { liked, counts } = await prisma.$transaction(async (tx) => {
          await advisoryLock(tx, `like:${listingId}:${decoded.uid}`);

          const existing = await tx.listingLike.findUnique({ where });

          if (existing) {
            await tx.listingLike.delete({ where });
          } else {
            // If two requests race, create may throw unique constraint. We handle it.
            try {
              await tx.listingLike.create({ data: { listingId, userId: decoded.uid } });
            } catch (e) {
              // If unique violation happened due to race, treat as liked=true
              // Prisma unique error code is P2002; but we can just ignore and proceed.
            }
          }

          const counts = await tx.listing.findUnique({
            where: { id: listingId },
            select: { _count: { select: { likes: true, comments: true, views: true } } },
          });

          // Re-check final existence for accurate "liked"
          const final = await tx.listingLike.findUnique({ where });

          return { liked: Boolean(final), counts };
        });

        return send(res, 200, {
          liked,
          likeCount: counts?._count?.likes ?? 0,
          commentCount: counts?._count?.comments ?? 0,
          viewCount: counts?._count?.views ?? 0,
        });
      }

      // -----------------------------------------------------------------------
      // Intent: addListingComment (rate-limited + idempotent-ish)
      // -----------------------------------------------------------------------
      if (intent === "addListingComment") {
        if (!checkRateLimitOr429(req, res, { scope: "post:addListingComment", limit: 30, windowMs: 60_000 }))
          return;

        const listingId = String(body.listingId || "");
        const text = String(body.body || "").trim();

        if (!listingId) return send(res, 400, { message: "Missing listingId" });
        if (!text) return send(res, 400, { message: "Comment cannot be empty" });
        if (text.length > 2000) return send(res, 400, { message: "Comment too long (max 2000 chars)" });

        const result = await prisma.$transaction(async (tx) => {
          await advisoryLock(tx, `comment:${listingId}:${decoded.uid}`);

          // Idempotency-ish: same body recently by same author on same listing
          const recentSame = await tx.listingComment.findFirst({
            where: {
              listingId,
              authorId: decoded.uid,
              body: text,
              createdAt: { gte: new Date(Date.now() - 30_000) },
            },
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

          const comment =
            recentSame ||
            (await tx.listingComment.create({
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
            }));

          const counts = await tx.listing.findUnique({
            where: { id: listingId },
            select: { _count: { select: { likes: true, comments: true, views: true } } },
          });

          return {
            comment,
            likeCount: counts?._count?.likes ?? 0,
            commentCount: counts?._count?.comments ?? 0,
            viewCount: counts?._count?.views ?? 0,
          };
        });

        if (userScopedIdemKey) setCachedIdem(userScopedIdemKey, 201, result, 2 * 60_000);

        return send(res, 201, result);
      }

      // -----------------------------------------------------------------------
      // Intent: checkout (Stripe) - improved idempotency to avoid duplicate sessions/purchases
      // NOTE: Your current design creates a Purchase immediately. We preserve that behavior,
      //       but we try hard not to create multiple purchases for the same buyer/listing.
      // -----------------------------------------------------------------------
      if (intent === "checkout") {
        if (!checkRateLimitOr429(req, res, { scope: "post:checkout", limit: 10, windowMs: 60_000 }))
          return;

        const listingId = body.listingId;
        if (!listingId) return send(res, 400, { message: "Missing listingId" });

        const listing = await prisma.listing.findUnique({
          where: { id: listingId },
          include: { seller: true },
        });

        if (!listing || listing.status !== "ACTIVE") {
          return send(res, 404, { message: "Listing not available" });
        }

        const stripe = getStripe();

        // Try to reuse a recent open session to be idempotent-ish
        // (This prevents multiple purchases from retries/double-clicks.)
        const recent = await prisma.purchase.findFirst({
          where: {
            listingId: listing.id,
            buyerId: decoded.uid,
            stripeSessionId: { not: null },
            createdAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) }, // 2 hours
          },
          orderBy: { createdAt: "desc" },
          select: { id: true, stripeSessionId: true },
        });

        if (recent?.stripeSessionId) {
          try {
            const existingSession = await stripe.checkout.sessions.retrieve(recent.stripeSessionId);
            if (existingSession?.url) {
              const payload = { checkoutUrl: existingSession.url };
              if (userScopedIdemKey) setCachedIdem(userScopedIdemKey, 200, payload, 2 * 60_000);
              return send(res, 200, payload);
            }
          } catch {
            // ignore and create new session
          }
        }

        // Stripe idempotency key (if provided) helps if Stripe itself retries
        const stripeIdemKey = idemKey ? `checkout:${decoded.uid}:${listing.id}:${idemKey}` : undefined;

        const session = await stripe.checkout.sessions.create(
          {
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
          },
          stripeIdemKey ? { idempotencyKey: stripeIdemKey } : undefined
        );

        // Create purchase record once per session
        await prisma.purchase.create({
          data: {
            listingId: listing.id,
            buyerId: decoded.uid,
            sellerId: listing.sellerId,
            amount: listing.price,
            stripeSessionId: session.id,
          },
        });

        const payload = { checkoutUrl: session.url };
        if (userScopedIdemKey) setCachedIdem(userScopedIdemKey, 200, payload, 2 * 60_000);

        return send(res, 200, payload);
      }

      // -----------------------------------------------------------------------
      // Default: Create / Update listing (upsert behavior based on body.id)
      // Adds income/expense support.
      // -----------------------------------------------------------------------
      if (!checkRateLimitOr429(req, res, { scope: "post:upsertListing", limit: 30, windowMs: 60_000 }))
        return;

      const {
        id,
        title,
        platform,
        categoryId,
        price,
        income, // NEW
        expense, // NEW
        description,
        image,
        images,
        metrics,
        status,
      } = body;

      const numericPrice = Number(price);
      if (!title || !platform || !description || !Number.isFinite(numericPrice) || numericPrice <= 0) {
        return send(res, 400, { message: "Missing/invalid required fields" });
      }

      const numericIncome = toNonNegativeIntOrNullOrUndefined(income);
      const numericExpense = toNonNegativeIntOrNullOrUndefined(expense);

      if (income !== undefined && numericIncome === undefined) {
        return send(res, 400, { message: "Invalid income (must be a number >= 0, or null)" });
      }
      if (expense !== undefined && numericExpense === undefined) {
        return send(res, 400, { message: "Invalid expense (must be a number >= 0, or null)" });
      }

      // Ensure user exists + role (admin-only categories)
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
      if (!platformRow) return send(res, 400, { message: "Invalid or inactive platform" });

      // Validate category + enforce admin-only
      let categoryToSet = null;
      if (categoryId) {
        const cat = await prisma.category.findUnique({
          where: { id: categoryId },
          select: { id: true, isActive: true, isAdminOnly: true },
        });

        if (!cat || !cat.isActive) return send(res, 400, { message: "Invalid category" });
        if (cat.isAdminOnly && dbUser.role !== "ADMIN") {
          return send(res, 403, { message: "This category is admin-only" });
        }
        categoryToSet = cat.id;
      }

      // Build final image gallery (max 6)
      const extraImages = cleanImageList(images);
      const cover = typeof image === "string" && image.trim() ? image.trim() : extraImages[0];

      if (!cover) return send(res, 400, { message: "Missing cover image" });

      // Put cover first, remove duplicates, keep max 6
      const finalImages = cleanImageList([cover, ...extraImages]).slice(0, 6);
      if (finalImages.length === 0) return send(res, 400, { message: "Missing images" });

      // -------------------
      // Update
      // -------------------
      if (id) {
        // Reduce race conditions: lock listing row "logically" per id
        const updated = await prisma.$transaction(async (tx) => {
          await advisoryLock(tx, `listing:update:${id}`);

          const existing = await tx.listing.findUnique({ where: { id } });
          if (!existing) {
            const err = new Error("Listing not found");
            err.statusCode = 404;
            throw err;
          }
          if (existing.sellerId !== decoded.uid) {
            const err = new Error("Forbidden");
            err.statusCode = 403;
            throw err;
          }

          return tx.listing.update({
            where: { id },
            data: {
              title,
              platform,
              categoryId: categoryToSet,
              price: Math.trunc(numericPrice),
              income: numericIncome, // NEW (undefined => no change, null => clear)
              expense: numericExpense, // NEW
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
        });

        return send(res, 200, { listing: updated });
      }

      // -------------------
      // Create
      // -------------------
      const created = await prisma.listing.create({
        data: {
          title,
          platform,
          categoryId: categoryToSet,
          price: Math.trunc(numericPrice),
          income: numericIncome ?? null, // NEW
          expense: numericExpense ?? null, // NEW
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

      return send(res, 201, { listing: created });
    }

    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { message: "Method not allowed" });
  } catch (e) {
    return send(res, e.statusCode ?? 500, { message: e.message ?? "Error" });
  }
}