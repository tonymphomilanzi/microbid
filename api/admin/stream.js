import { prisma } from "../_lib/prisma.js";
import { requireAuth } from "../_lib/auth.js";

function send(res, status, json) {
  return res.status(status).json(json);
}

function readJson(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === "object") return b;
  if (Buffer.isBuffer(b)) return JSON.parse(b.toString("utf8"));
  if (typeof b === "string") return JSON.parse(b);
  return {};
}

async function requireAdmin(req) {
  const decoded = await requireAuth(req);
  const u = await prisma.user.findUnique({
    where: { id: decoded.uid },
    select: { id: true, role: true },
  });
  if (!u || u.role !== "ADMIN") {
    const err = new Error("Admin only");
    err.statusCode = 403;
    throw err;
  }
  return decoded;
}

function getQuery(req) {
  if (req?.query && typeof req.query === "object") return req.query;
  const url = new URL(req.url || "", "http://localhost");
  return Object.fromEntries(url.searchParams.entries());
}

export default async function handler(req, res) {
  try {
    await requireAdmin(req);

    const q = getQuery(req);
    const id = q.id ? String(q.id) : null;

    // LIST
    if (req.method === "GET") {
      const status = (q.status || "").toString().toUpperCase(); // "ACTIVE" | "INACTIVE" | ""
      const where =
        status === "ACTIVE"
          ? { isActive: true }
          : status === "INACTIVE"
            ? { isActive: false }
            : {};

      const streams = await prisma.streamVideo.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 300,
        select: {
          id: true,
          title: true,
          caption: true,
          coverImageUrl: true,
          videoUrl: true,
          viewsCount: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          createdById: true,
        },
      });

      return send(res, 200, { streams });
    }

    // CREATE
    if (req.method === "POST") {
      const decoded = await requireAdmin(req);
      const body = readJson(req);

      const title = String(body.title || "").trim();
      const caption = body.caption ? String(body.caption).trim() : null;
      const coverImageUrl = String(body.coverImageUrl || "").trim();
      const videoUrl = String(body.videoUrl || "").trim();
      const isActive = body.isActive === undefined ? true : Boolean(body.isActive);

      if (!title) return send(res, 400, { message: "Missing title" });
      if (!coverImageUrl) return send(res, 400, { message: "Missing coverImageUrl" });
      if (!videoUrl) return send(res, 400, { message: "Missing videoUrl" });

      const created = await prisma.streamVideo.create({
        data: {
          title,
          caption,
          coverImageUrl,
          videoUrl,
          isActive,
          createdById: decoded.uid,
        },
      });

      return send(res, 201, { stream: created });
    }

    // UPDATE
    if (req.method === "PATCH") {
      if (!id) return send(res, 400, { message: "Missing id" });
      const body = readJson(req);

      const data = {};

      if (body.title !== undefined) data.title = String(body.title || "").trim();
      if (body.caption !== undefined) data.caption = body.caption ? String(body.caption).trim() : null;
      if (body.coverImageUrl !== undefined) data.coverImageUrl = String(body.coverImageUrl || "").trim();
      if (body.videoUrl !== undefined) data.videoUrl = String(body.videoUrl || "").trim();
      if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

      // admin can modify views
      if (body.viewsCount !== undefined) {
        const v = Math.trunc(Number(body.viewsCount));
        if (!Number.isFinite(v) || v < 0) return send(res, 400, { message: "viewsCount must be a non-negative integer" });
        data.viewsCount = v;
      }

      const updated = await prisma.streamVideo.update({
        where: { id },
        data,
      });

      return send(res, 200, { stream: updated });
    }

    // DELETE
    if (req.method === "DELETE") {
      if (!id) return send(res, 400, { message: "Missing id" });
      await prisma.streamVideo.delete({ where: { id } });
      return send(res, 200, { ok: true });
    }

    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return send(res, 405, { message: "Method not allowed" });
  } catch (e) {
    return send(res, e.statusCode ?? 500, { message: e.message ?? "Error" });
  }
}