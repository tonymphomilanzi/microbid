import { prisma } from "../_lib/prisma.js";
import { requireAuth } from "../_lib/auth.js";

function send(res, status, json) {
  return res.status(status).json(json);
}

function getQuery(req) {
  if (req?.query && typeof req.query === "object") return req.query;
  const url = new URL(req.url || "", "http://localhost");
  return Object.fromEntries(url.searchParams.entries());
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

function deviceIdFrom(req) {
  const did = String(req.headers["x-device-id"] || "").trim();
  return did || null;
}

async function advisoryLock(tx, lockKey) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
}

async function recordStreamViewTx(tx, streamId, uid, deviceId) {
  const viewerKey = uid ? `u:${uid}` : deviceId ? `d:${deviceId}` : null;
  if (!viewerKey) return false;

  await advisoryLock(tx, `stream:view:${streamId}`);
  await advisoryLock(tx, `stream:view:${streamId}:${viewerKey}`);

  try {
    await tx.streamVideoView.create({ data: { streamId, viewerKey } });
    await tx.streamVideo.update({
      where: { id: streamId },
      data: { viewsCount: { increment: 1 } },
    });
    return true;
  } catch (e) {
    if (e?.code === "P2002") return false; // already viewed
    throw e;
  }
}

export default async function handler(req, res) {
  try {
    const partsRaw = req.query?.path;
    const parts = (Array.isArray(partsRaw) ? partsRaw : partsRaw ? [partsRaw] : [])
      .map(String)
      .filter(Boolean);

    // GET /api/streams  (list)
    if (req.method === "GET" && parts.length === 0) {
      const q = getQuery(req);
      const take = Math.min(60, Math.max(1, Number(q.take || 24)));
      const cursor = q.cursor ? String(q.cursor) : null;

      const rows = await prisma.streamVideo.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          title: true,
          caption: true,
          coverImageUrl: true,
          videoUrl: true,
          viewsCount: true,
          createdAt: true,
        },
      });

      const hasMore = rows.length > take;
      const items = hasMore ? rows.slice(0, take) : rows;
      const nextCursor = hasMore ? items[items.length - 1]?.id : null;

      return send(res, 200, { streams: items, nextCursor });
    }

    // GET /api/streams/:id  (watch + record view)
    if (req.method === "GET" && parts.length === 1) {
      const id = parts[0];

      const stream = await prisma.streamVideo.findFirst({
        where: { id, isActive: true },
        select: {
          id: true,
          title: true,
          caption: true,
          coverImageUrl: true,
          videoUrl: true,
          viewsCount: true,
          createdAt: true,
        },
      });

      if (!stream) return send(res, 404, { message: "Not found" });

      const uid = await optionalAuthUid(req);
      const deviceId = deviceIdFrom(req);

      // best-effort view record (don’t block response)
      if (uid || deviceId) {
        prisma.$transaction((tx) => recordStreamViewTx(tx, id, uid, deviceId)).catch(() => {});
      }

      return send(res, 200, { stream });
    }

    res.setHeader("Allow", "GET");
    return send(res, 405, { message: "Method not allowed" });
  } catch (e) {
    return send(res, e.statusCode ?? 500, { message: e.message ?? "Error" });
  }
}