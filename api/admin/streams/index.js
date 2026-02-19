import { prisma } from "../_lib/prisma.js";

function send(res, status, json) {
  return res.status(status).json(json);
}

function getQuery(req) {
  if (req?.query && typeof req.query === "object") return req.query;
  const url = new URL(req.url || "", "http://localhost");
  return Object.fromEntries(url.searchParams.entries());
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return send(res, 405, { message: "Method not allowed" });
    }

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
  } catch (e) {
    return send(res, e.statusCode ?? 500, { message: e.message ?? "Error" });
  }
}