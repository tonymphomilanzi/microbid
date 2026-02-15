// /api/listings/[id].js
// -----------------------------------------------------------------------------
// Routes:
//   GET    /api/listings/:id
//   DELETE /api/listings/:id     (auth; owner only)
//
// Improvements added (without breaking response shapes):
//   income/expense automatically included (Prisma returns scalar fields by default)
//   best-effort rate limiting (in-memory; per warm lambda instance)
//   race-condition reduction for view recording using Postgres advisory locks
//   refactor + comments so it’s easy to find sections
// -----------------------------------------------------------------------------

import { prisma } from "../_lib/prisma.js";
import { requireAuth } from "../_lib/auth.js";

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

// -----------------------------
// Best-effort rate limiter (in-memory)
// NOTE: Serverless instances scale horizontally, so this is not global.
// Still helps against UI double-click + accidental spam.
// -----------------------------
const RL_BUCKETS = new Map(); // key -> { count, resetAt }
function rateLimit({ key, limit, windowMs }) {
  const now = Date.now();
  const cur = RL_BUCKETS.get(key);

  if (!cur || now > cur.resetAt) {
    RL_BUCKETS.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, resetAt: now + windowMs };
  }

  if (cur.count >= limit) {
    return { allowed: false, resetAt: cur.resetAt };
  }

  cur.count += 1;
  return { allowed: true, resetAt: cur.resetAt };
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
// Auth helpers
// -----------------------------
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

function deviceIdFrom(req) {
  const did = String(req.headers["x-device-id"] || "").trim();
  return did || null;
}

// -----------------------------
// Postgres advisory lock (race-condition reduction)
// Locks within the current transaction only.
// -----------------------------
async function advisoryLock(tx, lockKey) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
}

// -----------------------------
// Smart merge: device view -> user view (prevents double count on login/refresh)
// Returns true if a NEW unique view row was created, else false.
// Implemented inside a TX + advisory locks to reduce races.
// -----------------------------
async function recordListingViewSmartTx(tx, listingId, uid, deviceId) {
  const uKey = uid ? `u:${uid}` : null;
  const dKey = deviceId ? `d:${deviceId}` : null;

  // If neither exists, do nothing
  if (!uKey && !dKey) return false;

  // Lock per listing and viewer identities to serialize view writes
  // (prevents two concurrent requests double-inserting / conflicting updates)
  await advisoryLock(tx, `view:${listingId}`);
  if (uKey) await advisoryLock(tx, `view:${listingId}:${uKey}`);
  if (dKey) await advisoryLock(tx, `view:${listingId}:${dKey}`);

  // If logged in, prefer user key
  if (uKey) {
    // If we have a device key, try to "upgrade" device view to user view
    if (dKey) {
      const existingDevice = await tx.listingView.findUnique({
        where: { listingId_viewerKey: { listingId, viewerKey: dKey } },
        select: { id: true },
      });

      if (existingDevice) {
        // Attempt to update device row to user key.
        // This can hit unique constraint if user view already exists.
        try {
          await tx.listingView.update({
            where: { listingId_viewerKey: { listingId, viewerKey: dKey } },
            data: { viewerKey: uKey },
          });
        } catch (e) {
          // Prisma unique constraint violation -> P2002
          if (e?.code === "P2002") {
            // user view already exists; remove device row to avoid duplicates
            await tx.listingView
              .delete({ where: { listingId_viewerKey: { listingId, viewerKey: dKey } } })
              .catch(() => {});
          } else {
            throw e;
          }
        }
        // Upgrading a device view does NOT create a new unique view
        return false;
      }
    }

    // No device row to upgrade; try create user view
    try {
      await tx.listingView.create({ data: { listingId, viewerKey: uKey } });
      return true;
    } catch (e) {
      if (e?.code === "P2002") return false; // already viewed
      throw e;
    }
  }

  // Anonymous device view
  if (dKey) {
    try {
      await tx.listingView.create({ data: { listingId, viewerKey: dKey } });
      return true;
    } catch (e) {
      if (e?.code === "P2002") return false;
      throw e;
    }
  }

  return false;
}

// -----------------------------
// Handler
// -----------------------------
export default async function handler(req, res) {
  try {
    // Normalize id
    const rawId = req.query?.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id) return send(res, 400, { message: "Missing listing id" });

    // -------------------------------------------------------------------------
    // GET /api/listings/:id
    // Returns: { listing: safeListing }
    // -------------------------------------------------------------------------
    if (req.method === "GET") {
      if (!checkRateLimitOr429(req, res, { scope: "get:listing", limit: 180, windowMs: 60_000 }))
        return;

      const uid = await optionalAuthUid(req);
      const deviceId = deviceIdFrom(req);

      const listing = await prisma.listing.findUnique({
        where: { id },
        include: {
          // NOTE: Scalar fields (including income/expense) come automatically
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

      if (!listing) return send(res, 404, { message: "Not found" });

      // Do not record views for the seller viewing their own listing
      const createdView =
        !(uid && uid === listing.sellerId)
          ? await prisma.$transaction((tx) => recordListingViewSmartTx(tx, id, uid, deviceId))
          : false;

      // Ensure images is always an array (existing behavior)
      const images =
        Array.isArray(listing.images) && listing.images.length
          ? listing.images
          : listing.image
            ? [listing.image]
            : [];

      // listing._count.views was computed BEFORE the possible create,
      // so we add +1 when we know we created a new unique view.
      const baseViews = listing._count?.views ?? 0;
      const viewCount = createdView ? baseViews + 1 : baseViews;

      // Keep response shape the same as your UI expects
      const safeListing = {
        ...listing,
        images,
        likeCount: listing._count?.likes ?? 0,
        commentCount: listing._count?.comments ?? 0,
        viewCount,
        likedByMe: uid ? (listing.likes?.length ?? 0) > 0 : false,
      };

      // Remove internal helper objects
      delete safeListing._count;
      if (safeListing.likes) delete safeListing.likes;

      return send(res, 200, { listing: safeListing });
    }

    // -------------------------------------------------------------------------
    // DELETE /api/listings/:id
    // Returns: { ok: true }
    // -------------------------------------------------------------------------
    if (req.method === "DELETE") {
      if (!checkRateLimitOr429(req, res, { scope: "delete:listing", limit: 30, windowMs: 60_000 }))
        return;

      const decoded = await requireAuth(req);

      // Serialize deletes per listing id to reduce races
      await prisma.$transaction(async (tx) => {
        await advisoryLock(tx, `listing:delete:${id}`);

        const listing = await tx.listing.findUnique({ where: { id } });
        if (!listing) {
          const err = new Error("Not found");
          err.statusCode = 404;
          throw err;
        }
        if (listing.sellerId !== decoded.uid) {
          const err = new Error("Forbidden");
          err.statusCode = 403;
          throw err;
        }

        await tx.listing.delete({ where: { id } });
      });

      return send(res, 200, { ok: true });
    }

    res.setHeader("Allow", "GET, DELETE");
    return send(res, 405, { message: "Method not allowed" });
  } catch (e) {
    return send(res, e.statusCode ?? 500, { message: e.message ?? "Error" });
  }
}