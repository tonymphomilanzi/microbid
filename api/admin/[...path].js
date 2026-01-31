import { prisma } from "../_lib/prisma.js";
import { requireAdmin } from "../_lib/adminOnly.js";

function readJson(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === "object") return b;
  if (Buffer.isBuffer(b)) return JSON.parse(b.toString("utf8"));
  if (typeof b === "string") return JSON.parse(b);
  return {};
}

function asString(v) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function handler(req, res) {
  try {
    await requireAdmin(req);

    const path = req.query?.path || []; // catch-all segments
    const resource = path[0];           // "users" | "listings" | "platforms" | "categories"
    const id = path[1] || null;

    // ---------------- USERS ----------------
    if (resource === "users") {
      if (req.method === "GET") {
        const q = (asString(req.query?.q) || "").toString();

        const users = await prisma.user.findMany({
          where: q
            ? {
                OR: [
                  { email: { contains: q, mode: "insensitive" } },
                  { id: { contains: q, mode: "insensitive" } },
                ],
              }
            : {},
          orderBy: { createdAt: "desc" },
          take: 200,
          select: {
            id: true,
            email: true,
            role: true,
            tier: true,
            isVerified: true,
            verifiedAt: true,
            createdAt: true,
            _count: { select: { listings: true } },
          },
        });

        return res.status(200).json({ users });
      }

      if (req.method === "PATCH") {
        if (!id) return res.status(400).json({ message: "Missing user id" });

        const body = readJson(req);
        const { role, tier, isVerified } = body;

        const data = {};
        if (role) data.role = role; // USER|ADMIN
        if (tier) data.tier = tier; // FREE|PRO|VIP
        if (typeof isVerified === "boolean") {
          data.isVerified = isVerified;
          data.verifiedAt = isVerified ? new Date() : null;
        }

        const user = await prisma.user.update({
          where: { id },
          data,
          select: { id: true, email: true, role: true, tier: true, isVerified: true, verifiedAt: true },
        });

        return res.status(200).json({ user });
      }

      res.setHeader("Allow", "GET, PATCH");
      return res.status(405).json({ message: "Method not allowed" });
    }

    // ---------------- LISTINGS ----------------
    if (resource === "listings") {
      if (req.method === "GET") {
        const platform = asString(req.query?.platform);
        const categoryId = asString(req.query?.categoryId);
        const status = asString(req.query?.status);
        const q = (asString(req.query?.q) || "").toString();

        const where = {
          ...(platform ? { platform } : {}),
          ...(categoryId ? { categoryId } : {}),
          ...(status ? { status } : {}),
          ...(q
            ? {
                OR: [
                  { title: { contains: q, mode: "insensitive" } },
                  { description: { contains: q, mode: "insensitive" } },
                  { seller: { email: { contains: q, mode: "insensitive" } } },
                ],
              }
            : {}),
        };

        const listings = await prisma.listing.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: 300,
          include: {
            seller: { select: { id: true, email: true, isVerified: true, tier: true } },
            category: true,
          },
        });

        return res.status(200).json({ listings });
      }

      if (req.method === "PATCH") {
        if (!id) return res.status(400).json({ message: "Missing listing id" });
        const body = readJson(req);

        const updated = await prisma.listing.update({
          where: { id },
          data: {
            ...(body.status ? { status: body.status } : {}),
          },
        });

        return res.status(200).json({ listing: updated });
      }

      if (req.method === "DELETE") {
        if (!id) return res.status(400).json({ message: "Missing listing id" });
        await prisma.listing.delete({ where: { id } });
        return res.status(200).json({ ok: true });
      }

      res.setHeader("Allow", "GET, PATCH, DELETE");
      return res.status(405).json({ message: "Method not allowed" });
    }

    // ---------------- PLATFORMS ----------------
    if (resource === "platforms") {
      if (req.method === "GET") {
        const platforms = await prisma.platform.findMany({
          orderBy: [{ order: "asc" }, { name: "asc" }],
        });
        return res.status(200).json({ platforms });
      }

      if (req.method === "POST") {
        const body = readJson(req);
        const { name, slug, order, isActive } = body;
        if (!name || !slug) return res.status(400).json({ message: "Missing name/slug" });

        const platform = await prisma.platform.create({
          data: {
            name,
            slug,
            order: Number(order ?? 0),
            isActive: Boolean(isActive ?? true),
          },
        });

        return res.status(201).json({ platform });
      }

      if (req.method === "PATCH") {
        if (!id) return res.status(400).json({ message: "Missing platform id" });
        const body = readJson(req);

        const platform = await prisma.platform.update({
          where: { id },
          data: {
            ...(body.name !== undefined ? { name: body.name } : {}),
            ...(body.slug !== undefined ? { slug: body.slug } : {}),
            ...(body.order !== undefined ? { order: Number(body.order) } : {}),
            ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
          },
        });

        return res.status(200).json({ platform });
      }

      if (req.method === "DELETE") {
        if (!id) return res.status(400).json({ message: "Missing platform id" });
        await prisma.platform.delete({ where: { id } });
        return res.status(200).json({ ok: true });
      }

      res.setHeader("Allow", "GET, POST, PATCH, DELETE");
      return res.status(405).json({ message: "Method not allowed" });
    }

    // ---------------- CATEGORIES ----------------
    if (resource === "categories") {
      if (req.method === "GET") {
        const categories = await prisma.category.findMany({
          orderBy: [{ order: "asc" }, { name: "asc" }],
        });
        return res.status(200).json({ categories });
      }

      if (req.method === "POST") {
        const body = readJson(req);
        const { name, slug, order, isActive, isAdminOnly } = body;
        if (!name || !slug) return res.status(400).json({ message: "Missing name/slug" });

        const category = await prisma.category.create({
          data: {
            name,
            slug,
            order: Number(order ?? 0),
            isActive: Boolean(isActive ?? true),
            isAdminOnly: Boolean(isAdminOnly ?? false),
          },
        });

        return res.status(201).json({ category });
      }

      if (req.method === "PATCH") {
        if (!id) return res.status(400).json({ message: "Missing category id" });
        const body = readJson(req);

        const category = await prisma.category.update({
          where: { id },
          data: {
            ...(body.name !== undefined ? { name: body.name } : {}),
            ...(body.slug !== undefined ? { slug: body.slug } : {}),
            ...(body.order !== undefined ? { order: Number(body.order) } : {}),
            ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
            ...(body.isAdminOnly !== undefined ? { isAdminOnly: Boolean(body.isAdminOnly) } : {}),
          },
        });

        return res.status(200).json({ category });
      }

      if (req.method === "DELETE") {
        if (!id) return res.status(400).json({ message: "Missing category id" });
        await prisma.category.delete({ where: { id } });
        return res.status(200).json({ ok: true });
      }

      res.setHeader("Allow", "GET, POST, PATCH, DELETE");
      return res.status(405).json({ message: "Method not allowed" });
    }

    return res.status(404).json({ message: "Unknown admin resource" });
  } catch (e) {
    return res.status(e.statusCode ?? 500).json({ message: e.message ?? "Error" });
  }
}