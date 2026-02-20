// /api/listings/index.js
import { prisma } from "../_lib/prisma.js";
import { requireAuth } from "../_lib/auth.js";

// -----------------------------
// Response helper
// -----------------------------
function send(res, status, json) {
  return res.status(status).json(json);
}

// -----------------------------
// Query parsing (Vercel-safe)
// -----------------------------
function qv(v) {
  return Array.isArray(v) ? v[0] : v;
}

function getQuery(req) {
  if (req?.query && typeof req.query === "object") return req.query;
  const url = new URL(req.url || "", "http://localhost");
  return Object.fromEntries(url.searchParams.entries());
}

// -----------------------------
// Utilities
// -----------------------------
function getClientIp(req) {
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
  try {
    const b = req.body;
    if (!b) return {};
    if (typeof b === "object") return b;
    if (Buffer.isBuffer(b)) return safeJsonParse(b.toString("utf8"));
    if (typeof b === "string") return safeJsonParse(b);
    return {};
  } catch {
    return {};
  }
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
  const x = qv(v);
  if (x === undefined || x === null || x === "") return undefined;
  const n = Number(x);
  return Number.isFinite(n) ? n : undefined;
}

function toNonNegativeIntOrNullOrUndefined(v) {
  if (v === undefined) return undefined; // don't touch
  if (v === null || v === "") return null; // clear field
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  const int = Math.trunc(n);
  if (int < 0) return undefined;
  return int;
}

// optional integer percent (0..90) or null/undefined
function toIntPercentOrNullOrUndefined(v) {
  if (v === undefined) return undefined; // don't touch (important for edits)
  if (v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.trunc(n);
}

function cleanImageList(arr) {
  const list = Array.isArray(arr) ? arr : [];
  const cleaned = list
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);

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
  const headerKey =
    req.headers["idempotency-key"] ||
    req.headers["x-idempotency-key"] ||
    req.headers["Idempotency-Key"];

  const k =
    (typeof headerKey === "string" && headerKey.trim()) ||
    body?.idempotencyKey;
  return typeof k === "string" && k.trim() ? k.trim() : null;
}

async function listingAlreadySoldOrLocked(listingId) {
  const purchase = await prisma.purchase.findFirst({
    where: { listingId },
    select: { id: true },
  });
  if (purchase) return { blocked: true, reason: "SOLD" };

  const locked = await prisma.escrowTransaction.findFirst({
    where: {
      listingId,
      status: { in: ["FEE_PAID", "FULLY_PAID"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, buyerId: true, status: true },
  });

  if (locked) {
    return {
      blocked: true,
      reason: locked.status,
      buyerId: locked.buyerId,
      escrowId: locked.id,
    };
  }
  return { blocked: false };
}

// -----------------------------
// Rate limiting (in-memory)
// -----------------------------
const RL_BUCKETS = new Map();
function rateLimit({ key, limit, windowMs }) {
  const now = Date.now();
  const cur = RL_BUCKETS.get(key);

  if (!cur || now > cur.resetAt) {
    RL_BUCKETS.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, resetAt: now + windowMs };
  }
  if (cur.count >= limit) return { allowed: false, resetAt: cur.resetAt };

  cur.count += 1;
  return { allowed: true, resetAt: cur.resetAt };
}

function checkRateLimitOr429(req, res, { scope, limit, windowMs }) {
  const ip = getClientIp(req);
  const key = `rl:${scope}:${ip}`;
  const r = rateLimit({ key, limit, windowMs });

  if (!r.allowed) {
    res.setHeader(
      "Retry-After",
      String(Math.ceil((r.resetAt - Date.now()) / 1000))
    );
    send(res, 429, { message: "Too many requests. Please slow down." });
    return false;
  }
  return true;
}

// -----------------------------
// Idempotency cache (in-memory)
// -----------------------------
const IDEM = new Map();
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
// Advisory lock (race reduction)
// -----------------------------
async function advisoryLock(tx, lockKey) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
}

// -----------------------------
// AppConfig (DB settings) for manual checkout
// -----------------------------
const APP_CONFIG_CACHE = { value: null, exp: 0 };

function requireAppConfigModel() {
  if (!prisma.appConfig) {
    const err = new Error(
      "Prisma Client missing AppConfig. Add AppConfig to schema.prisma, run `npx prisma generate`, redeploy."
    );
    err.statusCode = 500;
    throw err;
  }
  return prisma.appConfig;
}

async function getAppConfigCached() {
  const now = Date.now();
  if (APP_CONFIG_CACHE.value && now < APP_CONFIG_CACHE.exp)
    return APP_CONFIG_CACHE.value;

  const AppConfig = requireAppConfigModel();

  const cfg =
    (await AppConfig.findUnique({ where: { id: "global" } }).catch(() => null)) ||
    (await AppConfig.create({ data: { id: "global", escrowFeeBps: 200 } }).catch(() => null));

  APP_CONFIG_CACHE.value = cfg;
  APP_CONFIG_CACHE.exp = now + 30_000;
  return cfg;
}

function validateManualConfigForMethod(cfg, method) {
  const missing = [];
  const has = (v) => Boolean(v && String(v).trim());

  if (method === "BTC") {
    if (!has(cfg?.companyBtcAddress)) missing.push("Bitcoin address");
  }
  if (method === "MOMO") {
    if (!has(cfg?.companyMomoName)) missing.push("MoMo account name");
    if (!has(cfg?.companyMomoNumber)) missing.push("MoMo number");
  }
  if (method === "WU") {
    if (!has(cfg?.companyWuName)) missing.push("WU receiver name");
    if (!has(cfg?.companyWuCountry)) missing.push("WU receiver country");
  }
  if (method === "BANK") {
    if (!has(cfg?.companyBankName)) missing.push("Bank name");
    if (!has(cfg?.companyBankAccountName)) missing.push("Bank account name");
    if (!has(cfg?.companyBankAccountNumber)) missing.push("Bank account number");
  }

  return missing;
}

function instructionsFromConfig(cfg, method, escrowId, totalChargeCents) {
  const totalUsd = (Number(totalChargeCents || 0) / 100).toFixed(2);

  const safe = (v) => (v && String(v).trim() ? String(v).trim() : "Not set");
  const opt = (v) => (v && String(v).trim() ? String(v).trim() : null);

  if (method === "BTC") {
    return {
      qrUrl: opt(cfg?.companyBtcQrUrl) || null,
      lines: [
        `Send exactly $${totalUsd} worth of BTC to the address below.`,
        `Reference code: ${escrowId}. Keep it for proof.`,
      ],
      fields: [
        { label: "BTC Address", value: safe(cfg?.companyBtcAddress) },
        { label: "Network", value: safe(cfg?.companyBtcNetwork || "Bitcoin") },
      ],
    };
  }

  if (method === "MOMO") {
    return {
      qrUrl: null,
      lines: [
        `Send exactly $${totalUsd} (or equivalent) to the Mobile Money details below.`,
        `Use reference code: ${escrowId} as the payment reference.`,
      ],
      fields: [
        { label: "Account Name", value: safe(cfg?.companyMomoName) },
        { label: "MoMo Number", value: safe(cfg?.companyMomoNumber) },
        { label: "Country", value: safe(cfg?.companyMomoCountry) },
      ],
    };
  }

  if (method === "WU") {
    return {
      qrUrl: null,
      lines: [
        `Send exactly $${totalUsd} via Western Union.`,
        `Use reference code: ${escrowId} (if possible).`,
      ],
      fields: [
        { label: "Receiver Name", value: safe(cfg?.companyWuName) },
        { label: "Receiver Country", value: safe(cfg?.companyWuCountry) },
        { label: "Receiver City", value: safe(cfg?.companyWuCity) },
      ],
    };
  }

  // BANK
  return {
    qrUrl: null,
    lines: [
      `Send exactly $${totalUsd} via bank transfer.`,
      `Put reference code: ${escrowId} in the transfer memo/reference.`,
    ],
    fields: [
      { label: "Bank Name", value: safe(cfg?.companyBankName) },
      { label: "Account Name", value: safe(cfg?.companyBankAccountName) },
      { label: "Account Number", value: safe(cfg?.companyBankAccountNumber) },
      { label: "SWIFT / IBAN", value: safe(cfg?.companyBankSwift) },
      { label: "Country", value: safe(cfg?.companyBankCountry) },
    ],
  };
}

// -----------------------------
// Stripe lazy loader (prevents GET from crashing)
// -----------------------------
async function getStripeLazy() {
  const mod = await import("../_lib/stripe.js");
  return mod.getStripe();
}

// -----------------------------
// Helper: detect streaming kit category
// -----------------------------
function isStreamingKitCategoryRow(cat) {
  if (!cat) return false;
  const slug = String(cat.slug || "").toLowerCase().trim();
  const name = String(cat.name || "").toLowerCase().trim();
  return slug === "streaming-kit" || name === "streaming kit" || name === "streaming-kit";
}

function applyDiscountIntPrice(priceInt, discountPercent) {
  const p = Math.trunc(Number(priceInt || 0));
  const d = Math.trunc(Number(discountPercent || 0));
  if (!Number.isFinite(p) || p <= 0) return p;
  if (!Number.isFinite(d) || d <= 0) return p;
  const next = Math.round((p * (100 - d)) / 100);
  return Math.max(1, next);
}

// -----------------------------
// Subscription/usage helpers (monthly limits) - REAL COUNT BASED
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

/**
 * Resolve effective plan limits:
 * - ADMIN => unlimited
 * - ACTIVE UserSubscription.plan => use that
 * - else Plan by user.tier
 * - else FREE
 */
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

  // If no plans exist, safest is block creation (0)
  return { listingsPerMonth: 0, conversationsPerMonth: 0 };
}

/**
 * Check if user can create a listing based on REAL count from database
 * This includes historical listings created before tracking was implemented
 */
async function checkListingsLimitOrThrow(tx, userId, mk, limit) {
  // unlimited if < 0
  if (typeof limit === "number" && limit < 0) return;

  if (!Number.isFinite(limit) || limit <= 0) {
    const err = new Error("Monthly listing limit reached. Upgrade to create more listings.");
    err.statusCode = 403;
    throw err;
  }

  const { start, end } = getMonthDateRange(mk);

  // Count actual listings created this month
  const currentCount = await tx.listing.count({
    where: {
      sellerId: userId,
      createdAt: { gte: start, lt: end },
    },
  });

  if (currentCount >= limit) {
    const err = new Error(
      `Monthly listing limit reached (${currentCount}/${limit}). Upgrade to create more listings.`
    );
    err.statusCode = 403;
    throw err;
  }
}

// -----------------------------
// Handler
// -----------------------------
export default async function handler(req, res) {
  try {
    const query = getQuery(req);

    // -------------------------
    // PUBLIC: listingComments
    // -------------------------
    if (req.method === "GET" && qv(query?.public) === "listingComments") {
      if (
        !checkRateLimitOr429(req, res, {
          scope: "get:listingComments",
          limit: 60,
          windowMs: 60_000,
        })
      )
        return;

      const listingId = String(qv(query?.listingId) || "");
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

    // -------------------------
    // PUBLIC: listingBids
    // -------------------------
    if (req.method === "GET" && qv(query?.public) === "listingBids") {
      if (
        !checkRateLimitOr429(req, res, {
          scope: "get:listingBids",
          limit: 60,
          windowMs: 60_000,
        })
      )
        return;

      const listingId = String(qv(query?.listingId) || "");
      if (!listingId) return send(res, 400, { message: "listingId is required" });

      const bids = await prisma.listingBid.findMany({
        where: { listingId },
        orderBy: [{ amount: "desc" }, { createdAt: "desc" }],
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
        minNextBid: highestBid + 1,
      });
    }

    // -------------------------
    // PUBLIC: list listings
    // -------------------------
    if (req.method === "GET") {
      if (
        !checkRateLimitOr429(req, res, {
          scope: "get:listings",
          limit: 120,
          windowMs: 60_000,
        })
      )
        return;

      const platform = qv(query?.platform);
      const categoryId = qv(query?.categoryId);
      const q = qv(query?.q);
      const minP = toNumberOrUndefined(query?.minPrice);
      const maxP = toNumberOrUndefined(query?.maxPrice);

      const where = {
        status: "ACTIVE",
        ...(platform ? { platform } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: String(q), mode: "insensitive" } },
                { description: { contains: String(q), mode: "insensitive" } },
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

      const uid = await optionalAuthUid(req);

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

    // -------------------------
    // AUTH: intents + upsert
    // -------------------------
    if (req.method === "POST") {
      if (
        !checkRateLimitOr429(req, res, {
          scope: "post:listings",
          limit: 120,
          windowMs: 60_000,
        })
      )
        return;

      const body = readJson(req);
      const intent = body.intent || "upsertListing";

      const preIdemKey = getIdempotencyKey(req, body);
      if (
        preIdemKey &&
        ["addListingBid", "addListingComment", "checkout", "startEscrow"].includes(intent)
      ) {
        const ip = getClientIp(req);
        const cacheKey = `idem:${intent}:${ip}:${preIdemKey}`;
        const cached = getCachedIdem(cacheKey);
        if (cached) return send(res, cached.status, cached.body);
      }

      const decoded = await requireAuth(req);

      const idemKey = getIdempotencyKey(req, body);
      const userScopedIdemKey =
        idemKey &&
        ["addListingBid", "addListingComment", "checkout", "startEscrow"].includes(intent)
          ? `idem:${intent}:u:${decoded.uid}:${idemKey}`
          : null;

      if (userScopedIdemKey) {
        const cached = getCachedIdem(userScopedIdemKey);
        if (cached) return send(res, cached.status, cached.body);
      }

      // -----------------------------------------------------------------------
      // Intent: acceptHighestBid (seller only)
      // -----------------------------------------------------------------------
      if (intent === "acceptHighestBid") {
        if (
          !checkRateLimitOr429(req, res, {
            scope: "post:acceptHighestBid",
            limit: 30,
            windowMs: 60_000,
          })
        )
          return;

        const listingId = String(body.listingId || "");
        if (!listingId) return send(res, 400, { message: "Missing listingId" });

        const result = await prisma.$transaction(async (tx) => {
          await advisoryLock(tx, `bid:acceptHighest:${listingId}`);

          const listing = await tx.listing.findUnique({
            where: { id: listingId },
            select: {
              id: true,
              sellerId: true,
              status: true,
              biddingClosed: true,
              acceptedBidId: true,
            },
          });

          if (!listing) {
            const err = new Error("Listing not found");
            err.statusCode = 404;
            throw err;
          }

          if (listing.sellerId !== decoded.uid) {
            const err = new Error("Forbidden");
            err.statusCode = 403;
            throw err;
          }

          if (listing.biddingClosed && listing.acceptedBidId) {
            const acceptedBid = await tx.listingBid.findUnique({
              where: { id: listing.acceptedBidId },
              include: { bidder: { select: { id: true, username: true, avatarUrl: true } } },
            });
            return { listing, acceptedBid };
          }

          const purchase = await tx.purchase.findFirst({
            where: { listingId },
            select: { id: true },
          });
          if (purchase) {
            const err = new Error("Listing already sold");
            err.statusCode = 409;
            throw err;
          }

          const top = await tx.listingBid.findFirst({
            where: { listingId },
            orderBy: [{ amount: "desc" }, { createdAt: "desc" }],
            include: {
              bidder: { select: { id: true, username: true, avatarUrl: true } },
            },
          });

          if (!top) {
            const err = new Error("No bids to accept");
            err.statusCode = 400;
            throw err;
          }

          const updatedListing = await tx.listing.update({
            where: { id: listingId },
            data: {
              biddingClosed: true,
              status: "INACTIVE",
              acceptedBidId: top.id,
              acceptedBidderId: top.bidderId,
              acceptedBidAmount: top.amount,
            },
            select: {
              id: true,
              status: true,
              biddingClosed: true,
              acceptedBidId: true,
              acceptedBidderId: true,
              acceptedBidAmount: true,
            },
          });

          const canNotify = Boolean(tx.notification);

          if (canNotify) {
            await tx.notification.create({
              data: {
                userId: top.bidderId,
                type: "BID_WON",
                title: "You won the bid",
                body: `Your bid of $${top.amount} was accepted. Complete payment to claim the listing.`,
                url: `/listings/${listingId}`,
                meta: { listingId, bidId: top.id, amount: top.amount },
              },
            });
          }

          return { listing: updatedListing, acceptedBid: top };
        });

        return send(res, 200, result);
      }

      // -------- addListingBid --------
      if (intent === "addListingBid") {
        if (
          !checkRateLimitOr429(req, res, {
            scope: "post:addListingBid",
            limit: 20,
            windowMs: 60_000,
          })
        )
          return;

        const listingId = String(body.listingId || "");
        const amount = Number(body.amount);

        if (!listingId) return send(res, 400, { message: "Missing listingId" });
        if (!Number.isFinite(amount) || amount <= 0)
          return send(res, 400, { message: "Invalid bid amount" });

        const listing = await prisma.listing.findUnique({
          where: { id: listingId },
          select: {
            id: true,
            sellerId: true,
            status: true,
            price: true,
            biddingClosed: true,
            acceptedBidId: true,
          },
        });

        if (!listing || listing.status !== "ACTIVE")
          return send(res, 404, { message: "Listing not available" });

        if (listing.biddingClosed || listing.acceptedBidId) {
          return send(res, 400, { message: "Bidding is closed for this listing." });
        }
        if (listing.sellerId === decoded.uid) {
          return send(res, 403, { message: "You cannot bid on your own listing." });
        }

        const result = await prisma.$transaction(async (tx) => {
          await advisoryLock(tx, `bid:${listingId}`);

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

        if (userScopedIdemKey) setCachedIdem(userScopedIdemKey, 201, result, 2 * 60_000);
        return send(res, 201, result);
      }

      // -------- toggleListingLike --------
      if (intent === "toggleListingLike") {
        if (
          !checkRateLimitOr429(req, res, {
            scope: "post:toggleListingLike",
            limit: 120,
            windowMs: 60_000,
          })
        )
          return;

        const listingId = String(body.listingId || "");
        if (!listingId) return send(res, 400, { message: "Missing listingId" });

        const where = { listingId_userId: { listingId, userId: decoded.uid } };

        const { liked, counts } = await prisma.$transaction(async (tx) => {
          await advisoryLock(tx, `like:${listingId}:${decoded.uid}`);

          const existing = await tx.listingLike.findUnique({ where });
          if (existing) await tx.listingLike.delete({ where });
          else {
            try {
              await tx.listingLike.create({ data: { listingId, userId: decoded.uid } });
            } catch {
              // ignore
            }
          }

          const counts = await tx.listing.findUnique({
            where: { id: listingId },
            select: { _count: { select: { likes: true, comments: true, views: true } } },
          });

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

      // -------- addListingComment --------
      if (intent === "addListingComment") {
        if (
          !checkRateLimitOr429(req, res, {
            scope: "post:addListingComment",
            limit: 30,
            windowMs: 60_000,
          })
        )
          return;

        const listingId = String(body.listingId || "");
        const text = String(body.body || "").trim();

        if (!listingId) return send(res, 400, { message: "Missing listingId" });
        if (!text) return send(res, 400, { message: "Comment cannot be empty" });
        if (text.length > 2000)
          return send(res, 400, { message: "Comment too long (max 2000 chars)" });

        const result = await prisma.$transaction(async (tx) => {
          await advisoryLock(tx, `comment:${listingId}:${decoded.uid}`);

          const comment = await tx.listingComment.create({
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

      // -------- startEscrow (manual) --------
      if (intent === "startEscrow") {
        if (
          !checkRateLimitOr429(req, res, {
            scope: "post:startEscrow",
            limit: 20,
            windowMs: 60_000,
          })
        )
          return;

        const listingId = String(body.listingId || "");
        const method = String(body.method || "").toUpperCase();

        if (!listingId) return send(res, 400, { message: "Missing listingId" });
        if (!method) return send(res, 400, { message: "Missing method" });

        const map = {
          BTC: { provider: "BTC", providerRef: null },
          MOMO: { provider: "MOMO", providerRef: null },
          WU: { provider: "MANUAL", providerRef: "WU" },
          BANK: { provider: "MANUAL", providerRef: "BANK" },
        };

        const mapped = map[method];
        if (!mapped) return send(res, 400, { message: "Unsupported payment method" });

        const listing = await prisma.listing.findUnique({
          where: { id: listingId },
          select: {
            id: true,
            price: true,
            status: true,
            sellerId: true,
            acceptedBidderId: true,
            acceptedBidAmount: true,
            acceptedBidId: true,
            discountPercent: true,
            category: { select: { slug: true, name: true } },
          },
        });

        if (!listing) return send(res, 404, { message: "Listing not available" });

        const allowedStatus = listing.acceptedBidId ? ["ACTIVE", "INACTIVE"] : ["ACTIVE"];
        if (!allowedStatus.includes(listing.status)) {
          return send(res, 404, { message: "Listing not available" });
        }

        if (listing.sellerId === decoded.uid)
          return send(res, 403, { message: "You cannot buy your own listing." });

        if (listing.acceptedBidId) {
          if (listing.acceptedBidderId !== decoded.uid) {
            return send(res, 409, {
              message: "This listing is reserved for another buyer (bid accepted).",
            });
          }
          if (!listing.acceptedBidAmount) {
            return send(res, 500, { message: "Accepted bid amount missing." });
          }
        }

        const lock = await listingAlreadySoldOrLocked(listingId);
        if (lock.blocked && lock.buyerId !== decoded.uid) {
          return send(res, 409, { message: "This listing is already reserved or sold." });
        }
        if (lock.blocked && lock.reason === "SOLD") {
          await prisma.listing.update({ where: { id: listingId }, data: { status: "SOLD" } }).catch(() => {});
          return send(res, 409, { message: "This listing is already sold." });
        }

        const cfg = await getAppConfigCached();
        const missing = validateManualConfigForMethod(cfg, method);
        if (missing.length) {
          return send(res, 400, {
            message: `Payment method not configured: missing ${missing.join(
              ", "
            )}. Ask admin to update Admin → Settings.`,
          });
        }

        const feeBps = Number(cfg?.escrowFeeBps ?? 200);
        const minFeeCents = 0;
        const escrowAgentId = "SYSTEM";

        const isKit = isStreamingKitCategoryRow(listing.category);

        const escrow = await prisma.$transaction(async (tx) => {
          await advisoryLock(tx, `escrow:start:${listingId}:${decoded.uid}:${method}`);

          const existing = await tx.escrowTransaction.findFirst({
            where: {
              listingId,
              buyerId: decoded.uid,
              provider: mapped.provider,
              providerRef: mapped.providerRef,
              status: { in: ["INITIATED", "FEE_PAID", "FULLY_PAID"] },
            },
            orderBy: { createdAt: "desc" },
          });

          if (existing) return existing;

          const basePrice = listing.acceptedBidId ? listing.acceptedBidAmount : listing.price;
          const discounted =
            !listing.acceptedBidId && isKit
              ? applyDiscountIntPrice(basePrice, listing.discountPercent)
              : basePrice;

          const priceCents = Math.trunc(Number(discounted) * 100);
          const calcFee = Math.round((priceCents * feeBps) / 10_000);
          const feeCents = Math.max(calcFee, minFeeCents);
          const totalChargeCents = priceCents + feeCents;

          return tx.escrowTransaction.create({
            data: {
              listingId,
              buyerId: decoded.uid,
              sellerId: listing.sellerId,
              escrowAgentId,
              mode: "SAFEST",
              provider: mapped.provider,
              providerRef: mapped.providerRef,
              status: "INITIATED",
              priceCents,
              feeBps,
              feeCents,
              minFeeCents,
              totalChargeCents,
            },
          });
        });

        const payload = {
          escrow,
          instructions: instructionsFromConfig(cfg, method, escrow.id, escrow.totalChargeCents),
        };

        if (userScopedIdemKey) setCachedIdem(userScopedIdemKey, 200, payload, 2 * 60_000);
        return send(res, 200, payload);
      }

      // -----------------------------------------------------------------------
      // Intent: submitEscrowPayment
      // -----------------------------------------------------------------------
      if (intent === "submitEscrowPayment") {
        if (
          !checkRateLimitOr429(req, res, {
            scope: "post:submitEscrowPayment",
            limit: 15,
            windowMs: 60_000,
          })
        )
          return;

        const escrowId = String(body.escrowId || "");
        const reference = String(body.reference || "").trim();
        const proofUrl = body.proofUrl ? String(body.proofUrl).trim() : null;
        const note = body.note ? String(body.note).trim() : null;

        if (!escrowId) return send(res, 400, { message: "Missing escrowId" });
        if (!reference) return send(res, 400, { message: "Payment reference is required" });

        const result = await prisma.$transaction(async (tx) => {
          await advisoryLock(tx, `escrow:submitPayment:${escrowId}`);

          const escrow = await tx.escrowTransaction.findUnique({ where: { id: escrowId } });
          if (!escrow) {
            const err = new Error("Escrow not found");
            err.statusCode = 404;
            throw err;
          }

          if (escrow.buyerId !== decoded.uid) {
            const err = new Error("Forbidden");
            err.statusCode = 403;
            throw err;
          }

          const purchase = await tx.purchase.findFirst({
            where: { listingId: escrow.listingId },
            select: { id: true },
          });
          if (purchase) {
            const err = new Error("Listing already sold");
            err.statusCode = 409;
            throw err;
          }

          if (!["INITIATED", "FEE_PAID"].includes(escrow.status)) {
            const err = new Error(`Cannot submit payment in status ${escrow.status}`);
            err.statusCode = 400;
            throw err;
          }

          const didTransition = escrow.status === "INITIATED";
          const canNotify = Boolean(tx.notification);

          const listingRow = await tx.listing.findUnique({
            where: { id: escrow.listingId },
            select: { title: true },
          });
          const listingTitle = listingRow?.title || "this listing";
          const listingUrl = `/listings/${escrow.listingId}`;

          const existingProof = await tx.escrowProof.findFirst({
            where: { escrowId, kind: "PAYMENT_PROOF", note: reference },
            orderBy: { createdAt: "desc" },
          });

          const proof =
            existingProof ||
            (await tx.escrowProof.create({
              data: { escrowId, kind: "PAYMENT_PROOF", url: proofUrl, note: reference },
            }));

          const updatedEscrow =
            escrow.status === "INITIATED"
              ? await tx.escrowTransaction.update({
                  where: { id: escrowId },
                  data: {
                    status: "FEE_PAID",
                    notes: note ? [escrow.notes, note].filter(Boolean).join("\n") : escrow.notes,
                  },
                })
              : escrow;

          await tx.listing.update({
            where: { id: escrow.listingId },
            data: { status: "INACTIVE" },
          });

          if (didTransition && canNotify) {
            await tx.notification.create({
              data: {
                userId: escrow.sellerId,
                type: "PAYMENT_SUBMITTED",
                title: "Payment submitted",
                body: `Buyer submitted payment details for "${listingTitle}". Pending verification.`,
                url: listingUrl,
                meta: { escrowId: escrow.id, listingId: escrow.listingId },
              },
            });

            await tx.notification.create({
              data: {
                userId: escrow.buyerId,
                type: "PAYMENT_SUBMITTED",
                title: "Payment submitted",
                body: `Your payment details for "${listingTitle}" were submitted and are pending verification.`,
                url: listingUrl,
                meta: { escrowId: escrow.id, listingId: escrow.listingId },
              },
            });
          }

          return { escrow: updatedEscrow, proof };
        });

        return send(res, 200, result);
      }

      // -------- checkout (Stripe) --------
      if (intent === "checkout") {
        if (
          !checkRateLimitOr429(req, res, {
            scope: "post:checkout",
            limit: 10,
            windowMs: 60_000,
          })
        )
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

        const stripe = await getStripeLazy();

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
          metadata: { listingId: listing.id, buyerId: decoded.uid, sellerId: listing.sellerId },
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

        return send(res, 200, { checkoutUrl: session.url });
      }

      // -------- default upsert listing --------
      if (
        !checkRateLimitOr429(req, res, {
          scope: "post:upsertListing",
          limit: 30,
          windowMs: 60_000,
        })
      )
        return;

      const {
        id,
        title,
        platform,
        categoryId,
        price,
        income,
        expense,
        discountPercent,
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

      const dp = toIntPercentOrNullOrUndefined(discountPercent);
      if (discountPercent !== undefined && dp === undefined) {
        return send(res, 400, { message: "Invalid discountPercent (must be an integer between 0 and 90, or null)" });
      }
      if (dp !== undefined && dp !== null && (dp < 0 || dp > 90)) {
        return send(res, 400, { message: "discountPercent must be between 0 and 90" });
      }

      const dbUser = await prisma.user.upsert({
        where: { id: decoded.uid },
        update: { email: decoded.email ?? "unknown" },
        create: { id: decoded.uid, email: decoded.email ?? "unknown" },
        select: { id: true, role: true, tier: true },
      });

      // Category lookup (also used for streaming kit detection)
      let categoryToSet = null;
      let categoryRow = null;

      if (categoryId) {
        const cat = await prisma.category.findUnique({
          where: { id: categoryId },
          select: { id: true, isActive: true, isAdminOnly: true, slug: true, name: true },
        });

        if (!cat || !cat.isActive) return send(res, 400, { message: "Invalid category" });
        if (cat.isAdminOnly && dbUser.role !== "ADMIN") {
          return send(res, 403, { message: "This category is admin-only" });
        }

        categoryRow = cat;
        categoryToSet = cat.id;
      }

      const isStreamingKit = isStreamingKitCategoryRow(categoryRow);

      // Enforce platform string for streaming kit products
      const finalPlatform = isStreamingKit ? "Streaming Kit" : String(platform);

      // Validate platform for non-streaming-kit listings
      const platformRow = await prisma.platform.findFirst({
        where: { name: finalPlatform, isActive: true },
        select: { id: true },
      });
      if (!platformRow && !isStreamingKit) {
        return send(res, 400, { message: "Invalid or inactive platform" });
      }

      const extraImages = cleanImageList(images);
      const cover = typeof image === "string" && image.trim() ? image.trim() : extraImages[0];
      if (!cover) return send(res, 400, { message: "Missing cover image" });

      const finalImages = cleanImageList([cover, ...extraImages]).slice(0, 6);
      if (finalImages.length === 0) return send(res, 400, { message: "Missing images" });

      // -------------------------
      // EDIT listing (no usage)
      // -------------------------
      if (id) {
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
              platform: finalPlatform,
              categoryId: categoryToSet,
              price: Math.trunc(numericPrice),

              income: isStreamingKit ? null : numericIncome,
              expense: isStreamingKit ? null : numericExpense,
              metrics: isStreamingKit ? null : metrics ?? undefined,

              // streaming kit only; non-kit always null
              discountPercent: isStreamingKit ? dp : null,

              description,
              image: finalImages[0],
              images: finalImages,
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

      // -------------------------
      // CREATE listing (check monthly limit based on real count)
      // -------------------------
      const created = await prisma.$transaction(async (tx) => {
        const mk = monthKey();

        // lock around check+create to reduce races
        await advisoryLock(tx, `usage:listings:${decoded.uid}:${mk}`);

        const features = await getEffectiveFeaturesForUser(tx, decoded.uid, dbUser.tier, dbUser.role);

        // ADMIN unlimited; otherwise check real count
        if (dbUser.role !== "ADMIN") {
          await checkListingsLimitOrThrow(tx, decoded.uid, mk, features.listingsPerMonth);
        }

        return tx.listing.create({
          data: {
            title,
            platform: finalPlatform,
            categoryId: categoryToSet,
            price: Math.trunc(numericPrice),

            income: isStreamingKit ? null : numericIncome ?? null,
            expense: isStreamingKit ? null : numericExpense ?? null,
            metrics: isStreamingKit ? null : metrics ?? null,

            discountPercent: isStreamingKit ? (dp === undefined ? null : dp) : null,

            description,
            image: finalImages[0],
            images: finalImages,
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
      });

      return send(res, 201, { listing: created });
    }

    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { message: "Method not allowed" });
  } catch (e) {
    console.error("API /listings crashed:", e);
    return send(res, e.statusCode ?? 500, { message: e.message ?? "Error" });
  }
}