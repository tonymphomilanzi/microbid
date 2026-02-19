import { prisma } from "./_lib/prisma.js";

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

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return send(res, 405, { message: "Method not allowed" });
    }

    // small caching helps (optional)
    res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=300");

    const q = getQuery(req);
    const slug = qv(q.slug);

    // GET one page by slug
    if (slug) {
      const page = await prisma.sitePage.findFirst({
        where: { slug: String(slug), isPublished: true },
        select: {
          slug: true,
          title: true,
          body: true,
          updatedAt: true,
        },
      });

      if (!page) return send(res, 404, { message: "Not found" });
      return send(res, 200, { page });
    }

    // GET list of published pages (optional)
    const pages = await prisma.sitePage.findMany({
      where: { isPublished: true },
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: {
        slug: true,
        title: true,
        updatedAt: true,
      },
    });

    return send(res, 200, { pages });
  } catch (e) {
    console.error("API /pages crashed:", e);
    return send(res, e.statusCode ?? 500, { message: e.message ?? "Error" });
  }
}