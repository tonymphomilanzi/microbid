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
//     - startEscrow   ✅ (MANUAL checkout: BTC / WU / MOMO / BANK)
//     - checkout (Stripe)  (kept for now; you can remove later)
//     - create/update listing (default when no intent)
//
// Improvements added (without breaking response shapes your UI expects):
//   ✅ income/expense support for listings (create + update)
//   ✅ best-effort rate limiting (in-memory; works per warm lambda instance)
//   ✅ race-condition reduction using Postgres advisory locks
//   ✅ best-effort idempotency (header/body key + dedupe windows for bids/comments/checkout/startEscrow)
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
  if (v === undefined) return undefined; // don't touch
  if (v === null || v === "") return null; // clear field

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

  const k = (typeof headerKey === "string" && headerKey.trim()) || body?.idempotencyKey;
  return typeof k === "string" && k.trim() ? k.trim() : null;
}

// -----------------------------
// Best-effort rate limiter (in-memory)
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
    res.setHeader("Retry-After", String(Math.ceil((r.resetAt - Date.now()) / 1000)));
    send(res, 429, { message: "Too many requests. Please slow down." });
    return false;
  }
  return true;
}

// -----------------------------
// Best-effort idempotency cache (in-memory)
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
// Advisory locks (race reduction)
// -----------------------------
async function advisoryLock(tx, lockKey) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
}


// cached singleton config (reduces DB hits)
const APP_CONFIG_CACHE = { value: null, exp: 0 };

async function getAppConfigCached() {
  const now = Date.now();
  if (APP_CONFIG_CACHE.value && now < APP_CONFIG_CACHE.exp) return APP_CONFIG_CACHE.value;

  const cfg =
    (await prisma.appConfig.findUnique({ where: { id: "global" } }).catch(() => null)) ||
    (await prisma.appConfig.create({ data: { id: "global", escrowFeeBps: 200 } }).catch(() => null));

  APP_CONFIG_CACHE.value = cfg;
  APP_CONFIG_CACHE.exp = now + 30_000; // 30s cache
  return cfg;
}

function instructionsFromConfig(cfg, method, escrowId, totalChargeCents) {
  const totalUsd = (Number(totalChargeCents || 0) / 100).toFixed(2);

  if (method === "BTC") {
    return {
      lines: [
        `Send exactly $${totalUsd} worth of BTC to the address below.`,
        `Reference code: ${escrowId}. Keep it for proof.`,
      ],
      fields: [
        { label: "BTC Address", value: cfg?.companyBtcAddress || "" },
        { label: "Network", value: cfg?.companyBtcNetwork || "Bitcoin" },
      ],
    };
  }

  if (method === "MOMO") {
    return {
      lines: [
        `Send exactly $${totalUsd} (or equivalent) to the Mobile Money details below.`,
        `Use reference code: ${escrowId} as the payment reference.`,
      ],
      fields: [
        { label: "Account Name", value: cfg?.companyMomoName || "" },
        { label: "MoMo Number", value: cfg?.companyMomoNumber || "" },
        { label: "Country", value: cfg?.companyMomoCountry || "" },
      ],
    };
  }

  if (method === "WU") {
    return {
      lines: [
        `Send exactly $${totalUsd} via Western Union.`,
        `Use reference code: ${escrowId} (if possible).`,
      ],
      fields: [
        { label: "Receiver Name", value: cfg?.companyWuName || "" },
        { label: "Receiver Country", value: cfg?.companyWuCountry || "" },
        { label: "Receiver City", value: cfg?.companyWuCity || "" },
      ],
    };
  }

  // BANK
  return {
    lines: [
      `Send exactly $${totalUsd} via bank transfer.`,
      `Put reference code: ${escrowId} in the transfer memo/reference.`,
    ],
    fields: [
      { label: "Bank Name", value: cfg?.companyBankName || "" },
      { label: "Account Name", value: cfg?.companyBankAccountName || "" },
      { label: "Account Number", value: cfg?.companyBankAccountNumber || "" },
      { label: "SWIFT / IBAN", value: cfg?.companyBankSwift || "" },
      { label: "Country", value: cfg?.companyBankCountry || "" },
    ],
  };
}
// -----------------------------
// Deposit instructions builder (company-controlled)
// Put these in Vercel env vars so you can change without code edits.
// -----------------------------
function instructionsForManualMethod(method, escrowId, totalChargeCents) {
  const totalUsd = (Number(totalChargeCents || 0) / 100).toFixed(2);

  if (method === "BTC") {
    return {
      lines: [
        `Send exactly $${totalUsd} worth of BTC to the address below.`,
        `Reference code: ${escrowId}. Keep it for proof.`,
        "After payment, keep your transaction hash as proof (proof upload can be added later).",
      ],
      fields: [
        { label: "BTC Address", value: process.env.COMPANY_BTC_ADDRESS || "SET_COMPANY_BTC_ADDRESS" },
        { label: "Network", value: process.env.COMPANY_BTC_NETWORK || "Bitcoin" },
      ],
    };
  }

  if (method === "MOMO") {
    return {
      lines: [
        `Send exactly $${totalUsd} (or equivalent) to the Mobile Money details below.`,
        `Use reference code: ${escrowId} as the payment reference.`,
        "Keep the SMS/receipt as proof.",
      ],
      fields: [
        { label: "Account Name", value: process.env.COMPANY_MOMO_NAME || "SET_COMPANY_MOMO_NAME" },
        { label: "MoMo Number", value: process.env.COMPANY_MOMO_NUMBER || "SET_COMPANY_MOMO_NUMBER" },
        { label: "Country", value: process.env.COMPANY_MOMO_COUNTRY || "SET_COMPANY_MOMO_COUNTRY" },
      ],
    };
  }

  if (method === "WU") {
    return {
      lines: [
        `Send exactly $${totalUsd} via Western Union.`,
        `Use reference code: ${escrowId} (if a note/message is possible).`,
        "Keep the MTCN code as proof.",
      ],
      fields: [
        { label: "Receiver Name", value: process.env.COMPANY_WU_NAME || "SET_COMPANY_WU_NAME" },
        { label: "Receiver Country", value: process.env.COMPANY_WU_COUNTRY || "SET_COMPANY_WU_COUNTRY" },
        { label: "Receiver City", value: process.env.COMPANY_WU_CITY || "SET_COMPANY_WU_CITY" },
      ],
    };
  }

  // BANK
  return {
    lines: [
      `Send exactly $${totalUsd} via bank transfer.`,
      `Put reference code: ${escrowId} in the transfer reference/memo.`,
      "Keep the transfer receipt as proof.",
    ],
    fields: [
      { label: "Bank Name", value: process.env.COMPANY_BANK_NAME || "SET_COMPANY_BANK_NAME" },
      { label: "Account Name", value: process.env.COMPANY_BANK_ACCOUNT_NAME || "SET_COMPANY_BANK_ACCOUNT_NAME" },
      { label: "Account Number", value: process.env.COMPANY_BANK_ACCOUNT_NUMBER || "SET_COMPANY_BANK_ACCOUNT_NUMBER" },
      { label: "IBAN / SWIFT (optional)", value: process.env.COMPANY_BANK_SWIFT || "OPTIONAL" },
      { label: "Country", value: process.env.COMPANY_BANK_COUNTRY || "SET_COMPANY_BANK_COUNTRY" },
    ],
  };
}

// -----------------------------
// Main handler
// -----------------------------
export default async function handler(req, res) {
  try {
    // -------------------------------------------------------------------------
    // PUBLIC GET: listing comments
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
    // -------------------------------------------------------------------------
    if (req.method === "GET" && req.query?.public === "listingBids") {
      if (!checkRateLimitOr429(req, res, { scope: "get:listingBids", limit: 60, windowMs: 60_000 }))
        return;

      const listingId = String(req.query?.listingId || "");
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

      return send(res, 200, { bids, bidCount, highestBid, minNextBid: highestBid + 1 });
    }

    // -------------------------------------------------------------------------
    // PUBLIC GET: list listings
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

    // -------------------------------------------------------------------------
    // AUTH POST: intents + create/update
    // -------------------------------------------------------------------------
    if (req.method === "POST") {
      if (!checkRateLimitOr429(req, res, { scope: "post:listings", limit: 120, windowMs: 60_000 }))
        return;

      const body = readJson(req);
      const intent = body.intent || "upsertListing";

      // Pre-auth idempotency cache for common retry/double-submit intents
      const preIdemKey = getIdempotencyKey(req, body);
      if (preIdemKey && ["addListingBid", "addListingComment", "checkout", "startEscrow"].includes(intent)) {
        const ip = getClientIp(req);
        const cacheKey = `idem:${intent}:${ip}:${preIdemKey}`;
        const cached = getCachedIdem(cacheKey);
        if (cached) return send(res, cached.status, cached.body);
      }

      const decoded = await requireAuth(req);

      const idemKey = getIdempotencyKey(req, body);
      const userScopedIdemKey =
        idemKey && ["addListingBid", "addListingComment", "checkout", "startEscrow"].includes(intent)
          ? `idem:${intent}:u:${decoded.uid}:${idemKey}`
          : null;

      if (userScopedIdemKey) {
        const cached = getCachedIdem(userScopedIdemKey);
        if (cached) return send(res, cached.status, cached.body);
      }

      // -----------------------------------------------------------------------
      // Intent: addListingBid
      // -----------------------------------------------------------------------
      if (intent === "addListingBid") {
        if (!checkRateLimitOr429(req, res, { scope: "post:addListingBid", limit: 20, windowMs: 60_000 }))
          return;

        const listingId = String(body.listingId || "");
        const amount = Number(body.amount);

        if (!listingId) return send(res, 400, { message: "Missing listingId" });
        if (!Number.isFinite(amount) || amount <= 0) return send(res, 400, { message: "Invalid bid amount" });

        const listing = await prisma.listing.findUnique({
          where: { id: listingId },
          select: { id: true, sellerId: true, status: true, price: true },
        });

        if (!listing || listing.status !== "ACTIVE") return send(res, 404, { message: "Listing not available" });
        if (listing.sellerId === decoded.uid) return send(res, 403, { message: "You cannot bid on your own listing." });

        const result = await prisma.$transaction(async (tx) => {
          await advisoryLock(tx, `bid:${listingId}`);

          const recentSame = await tx.listingBid.findFirst({
            where: {
              listingId,
              bidderId: decoded.uid,
              amount: Math.trunc(amount),
              createdAt: { gte: new Date(Date.now() - 30_000) },
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

        if (userScopedIdemKey) setCachedIdem(userScopedIdemKey, 201, result, 2 * 60_000);
        return send(res, 201, result);
      }

      // -----------------------------------------------------------------------
      // Intent: toggleListingLike
      // -----------------------------------------------------------------------
      if (intent === "toggleListingLike") {
        if (!checkRateLimitOr429(req, res, { scope: "post:toggleListingLike", limit: 120, windowMs: 60_000 }))
          return;

        const listingId = String(body.listingId || "");
        if (!listingId) return send(res, 400, { message: "Missing listingId" });

        const where = { listingId_userId: { listingId, userId: decoded.uid } };

        const { liked, counts } = await prisma.$transaction(async (tx) => {
          await advisoryLock(tx, `like:${listingId}:${decoded.uid}`);

          const existing = await tx.listingLike.findUnique({ where });

          if (existing) {
            await tx.listingLike.delete({ where });
          } else {
            try {
              await tx.listingLike.create({ data: { listingId, userId: decoded.uid } });
            } catch {
              // ignore (unique race)
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

      // -----------------------------------------------------------------------
      // Intent: addListingComment
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
      // Intent: startEscrow  ✅ MANUAL PAYMENTS (BTC / WU / MOMO / BANK)
      //
      // Uses your Prisma model EscrowTransaction:
      //   provider: BTC | MOMO | MANUAL
      //   providerRef: "WU" or "BANK" when provider=MANUAL
      // Fee: default 2% (200 bps). Admin-configurable later; for now env-based.
      //
      // Response shape for frontend:
      //   { escrow: EscrowTransaction, instructions: { lines:[], fields:[] } }
      // -----------------------------------------------------------------------
      if (intent === "startEscrow") {

        
        if (!checkRateLimitOr429(req, res, { scope: "post:startEscrow", limit: 20, windowMs: 60_000 }))
          return;

        const listingId = String(body.listingId || "");
        const method = String(body.method || "").toUpperCase();

        if (!listingId) return send(res, 400, { message: "Missing listingId" });
        if (!method) return send(res, 400, { message: "Missing method" });

        // UI methods -> Prisma enums
        // Your PaymentProvider enum supports BTC, MOMO, MANUAL.
        // WU/BANK are represented as provider=MANUAL + providerRef.
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
          select: { id: true, title: true, price: true, status: true, sellerId: true },
        });

        if (!listing || listing.status !== "ACTIVE") {
          return send(res, 404, { message: "Listing not available" });
        }
        if (listing.sellerId === decoded.uid) {
          return send(res, 403, { message: "You cannot buy your own listing." });
        }

        // Defaults: 2% fee
  const cfg = await getAppConfigCached();

const feeBps = Number(cfg?.escrowFeeBps ?? 200);
const minFeeCents = Number(process.env.ESCROW_MIN_FEE_CENTS ?? 0); // optional keep as env


        // Not a relation in your schema, so any string is acceptable.
        // Set this in Vercel env to your company/admin uid (or a system string).
       const escrowAgentId = String(cfg?.escrowAgentUid || "SYSTEM");

        const escrow = await prisma.$transaction(async (tx) => {
          await advisoryLock(tx, `escrow:start:${listingId}:${decoded.uid}:${method}`);

          // Idempotency without requiring a key:
          // reuse latest "open" escrow for buyer+listing+method if it exists.
          const existing = await tx.escrowTransaction.findFirst({
            where: {
              listingId,
              buyerId: decoded.uid,
              provider: mapped.provider,
              providerRef: mapped.providerRef,
              status: {
                in: [
                  "INITIATED",
                  "FEE_PAID",
                  "FULLY_PAID",
                  "AWAITING_SELLER_ASSIGN_ESCROW",
                  "ESCROW_ASSIGNED",
                  "BUYER_ASSIGNED_MANAGER",
                ],
              },
            },
            orderBy: { createdAt: "desc" },
          });

          if (existing) return existing;

          const priceCents = Math.trunc(Number(listing.price) * 100);
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
      // Intent: checkout (Stripe)  (kept; you can remove later)
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

        const recent = await prisma.purchase.findFirst({
          where: {
            listingId: listing.id,
            buyerId: decoded.uid,
            stripeSessionId: { not: null },
            createdAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
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
            // ignore
          }
        }

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
                  product_data: { name: listing.title, images: listing.image ? [listing.image] : [] },
                },
              },
            ],
            metadata: { listingId: listing.id, buyerId: decoded.uid, sellerId: listing.sellerId },
          },
          stripeIdemKey ? { idempotencyKey: stripeIdemKey } : undefined
        );

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
      // Default: Create / Update listing
      // -----------------------------------------------------------------------
      if (!checkRateLimitOr429(req, res, { scope: "post:upsertListing", limit: 30, windowMs: 60_000 }))
        return;

      const {
        id,
        title,
        platform,
        categoryId,
        price,
        income,
        expense,
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

      const dbUser = await prisma.user.upsert({
        where: { id: decoded.uid },
        update: { email: decoded.email ?? "unknown" },
        create: { id: decoded.uid, email: decoded.email ?? "unknown" },
        select: { id: true, role: true },
      });

      const platformRow = await prisma.platform.findFirst({
        where: { name: platform, isActive: true },
        select: { id: true },
      });
      if (!platformRow) return send(res, 400, { message: "Invalid or inactive platform" });

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

      const extraImages = cleanImageList(images);
      const cover = typeof image === "string" && image.trim() ? image.trim() : extraImages[0];
      if (!cover) return send(res, 400, { message: "Missing cover image" });

      const finalImages = cleanImageList([cover, ...extraImages]).slice(0, 6);
      if (finalImages.length === 0) return send(res, 400, { message: "Missing images" });

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
              platform,
              categoryId: categoryToSet,
              price: Math.trunc(numericPrice),
              income: numericIncome,
              expense: numericExpense,
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

      const created = await prisma.listing.create({
        data: {
          title,
          platform,
          categoryId: categoryToSet,
          price: Math.trunc(numericPrice),
          income: numericIncome ?? null,
          expense: numericExpense ?? null,
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