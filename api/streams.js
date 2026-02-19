import { prisma } from "./_lib/prisma.js";
import { requireAuth } from "./_lib/auth.js";

function send(res, status, json) {
  return res.status(status).json(json);
}

function qv(v) {
  return Array.isArray(v) ? v[0] : v;
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
    // Prisma unique violation => already viewed
    if (e?.code === "P2002") return false;
    throw e;
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return send(res, 405, { message: "Method not allowed" });
    }

    const query = getQuery(req);

    // -----------------------------
    // GET /api/streams?id=<id> (single + record view)
    // -----------------------------
    const id = qv(query.id);
    if (id) {
      const uid = await optionalAuthUid(req);
      const deviceId = deviceIdFrom(req);

      const stream = await prisma.streamVideo.findFirst({
        where: { id: String(id), isActive: true },
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

      // best-effort view record (don’t block response)
      if (uid || deviceId) {
        prisma.$transaction((tx) => recordStreamViewTx(tx, String(id), uid, deviceId)).catch(() => {});
      }

      return send(res, 200, { stream });
    }

    // -----------------------------
    // GET /api/streams?take=24&cursor=...
    // -----------------------------
    const take = Math.min(60, Math.max(1, Number(qv(query.take) || 24)));
    const cursor = qv(query.cursor) ? String(qv(query.cursor)) : null;

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
    const streams = hasMore ? rows.slice(0, take) : rows;
    const nextCursor = hasMore ? streams[streams.length - 1]?.id : null;

    return send(res, 200, { streams, nextCursor });
  } catch (e) {
    console.error("API /streams crashed:", e);
    return send(res, e.statusCode ?? 500, { message: e.message ?? "Error" });
  }
}