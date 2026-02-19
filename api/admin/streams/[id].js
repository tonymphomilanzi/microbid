import { prisma } from "../../_lib/prisma.js";
import { requireAuth } from "../../_lib/auth.js";

function send(res, status, json) {
  return res.status(status).json(json);
}

function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) return xff.split(",")[0].trim();
  return req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown";
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
  const uKey = uid ? `u:${uid}` : null;
  const dKey = deviceId ? `d:${deviceId}` : null;

  const viewerKey = uKey || dKey;
  if (!viewerKey) return false;

  await advisoryLock(tx, `stream:view:${streamId}`);
  await advisoryLock(tx, `stream:view:${streamId}:${viewerKey}`);

  // create view if not exists
  try {
    await tx.streamVideoView.create({
      data: { streamId, viewerKey },
    });

    // increment viewsCount only if new unique view
    await tx.streamVideo.update({
      where: { id: streamId },
      data: { viewsCount: { increment: 1 } },
    });

    return true;
  } catch (e) {
    if (e?.code === "P2002") return false; // unique constraint => already viewed
    throw e;
  }
}

export default async function handler(req, res) {
  try {
    const rawId = req.query?.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id) return send(res, 400, { message: "Missing stream id" });

    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return send(res, 405, { message: "Method not allowed" });
    }

    const uid = await optionalAuthUid(req);
    const deviceId = deviceIdFrom(req);

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

    // record view best-effort (don’t block response if it fails)
    if (uid || deviceId) {
      prisma
        .$transaction((tx) => recordStreamViewTx(tx, id, uid, deviceId))
        .catch(() => {});
    } else {
      // no device id => can’t dedupe; recommend sending x-device-id from client
      const ip = getClientIp(req);
      // optional: you could choose to count by ip, but I’m leaving it off
      void ip;
    }

    return send(res, 200, { stream });
  } catch (e) {
    return send(res, e.statusCode ?? 500, { message: e.message ?? "Error" });
  }
}