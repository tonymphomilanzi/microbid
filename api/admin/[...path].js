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

function strOrNullOrUndefined(v) {
  // undefined => don't change
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function intOrUndefined(v) {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.trunc(n);
}

async function getOrCreateGlobalConfig() {
  const existing = await prisma.appConfig.findUnique({ where: { id: "global" } });
  if (existing) return existing;

  return prisma.appConfig.create({
    data: { id: "global", escrowFeeBps: 200 },
  });
}

export default async function handler(req, res) {
  try {
    const { decoded } = await requireAdmin(req);
    const adminUid = decoded.uid;

    const url = new URL(req.url, "http://localhost");

    // url.pathname could be:
    // /api/admin
    // /api/admin/users
    // /api/admin/users/<id>
    const parts = url.pathname
      .replace(/^\/api\/admin\/?/, "")
      .split("/")
      .filter(Boolean);

    const resource = parts[0] || ""; // users | listings | platforms | categories | feed | settings
    const id = parts[1] || url.searchParams.get("id") || null;

    // nice health response
    if (!resource) {
      return res.status(200).json({
        ok: true,
        resources: ["users", "listings", "platforms", "categories", "feed", "settings"],
      });
    }

    // ---------------- SETTINGS (ESCROW + PAYMENT DETAILS) ----------------
    // GET    /api/admin/settings
    // PATCH  /api/admin/settings
    //
    // Stores the values you previously kept in env vars:
    // - escrowAgentUid (ESCROW_AGENT_UID)
    // - escrowFeeBps (2% default = 200)
    // - BTC/MOMO/WU/BANK deposit details
    if (resource === "settings") {
      if (req.method === "GET") {
        const settings = await getOrCreateGlobalConfig();
        return res.status(200).json({ settings });
      }

      if (req.method === "PATCH") {
        const body = readJson(req);
        // allow { settings: {...} } or flat body
        const s = body.settings && typeof body.settings === "object" ? body.settings : body;

        const escrowFeeBps = intOrUndefined(s.escrowFeeBps);
        if (escrowFeeBps !== undefined && (escrowFeeBps < 0 || escrowFeeBps > 2000)) {
          return res.status(400).json({ message: "escrowFeeBps must be between 0 and 2000" });
        }

        const updated = await prisma.appConfig.upsert({
          where: { id: "global" },
          create: {
            id: "global",
            escrowAgentUid: strOrNullOrUndefined(s.escrowAgentUid) ?? null,
            escrowFeeBps: escrowFeeBps ?? 200,

            companyBtcAddress: strOrNullOrUndefined(s.companyBtcAddress) ?? null,
            companyBtcNetwork: strOrNullOrUndefined(s.companyBtcNetwork) ?? null,

            companyMomoName: strOrNullOrUndefined(s.companyMomoName) ?? null,
            companyMomoNumber: strOrNullOrUndefined(s.companyMomoNumber) ?? null,
            companyMomoCountry: strOrNullOrUndefined(s.companyMomoCountry) ?? null,

            companyWuName: strOrNullOrUndefined(s.companyWuName) ?? null,
            companyWuCountry: strOrNullOrUndefined(s.companyWuCountry) ?? null,
            companyWuCity: strOrNullOrUndefined(s.companyWuCity) ?? null,

            companyBankName: strOrNullOrUndefined(s.companyBankName) ?? null,
            companyBankAccountName: strOrNullOrUndefined(s.companyBankAccountName) ?? null,
            companyBankAccountNumber: strOrNullOrUndefined(s.companyBankAccountNumber) ?? null,
            companyBankSwift: strOrNullOrUndefined(s.companyBankSwift) ?? null,
            companyBankCountry: strOrNullOrUndefined(s.companyBankCountry) ?? null,
          },
          update: {
            escrowAgentUid: strOrNullOrUndefined(s.escrowAgentUid),
            escrowFeeBps,

            companyBtcAddress: strOrNullOrUndefined(s.companyBtcAddress),
            companyBtcNetwork: strOrNullOrUndefined(s.companyBtcNetwork),

            companyMomoName: strOrNullOrUndefined(s.companyMomoName),
            companyMomoNumber: strOrNullOrUndefined(s.companyMomoNumber),
            companyMomoCountry: strOrNullOrUndefined(s.companyMomoCountry),

            companyWuName: strOrNullOrUndefined(s.companyWuName),
            companyWuCountry: strOrNullOrUndefined(s.companyWuCountry),
            companyWuCity: strOrNullOrUndefined(s.companyWuCity),

            companyBankName: strOrNullOrUndefined(s.companyBankName),
            companyBankAccountName: strOrNullOrUndefined(s.companyBankAccountName),
            companyBankAccountNumber: strOrNullOrUndefined(s.companyBankAccountNumber),
            companyBankSwift: strOrNullOrUndefined(s.companyBankSwift),
            companyBankCountry: strOrNullOrUndefined(s.companyBankCountry),
          },
        });

        return res.status(200).json({ settings: updated });
      }

      res.setHeader("Allow", "GET, PATCH");
      return res.status(405).json({ message: "Method not allowed" });
    }

    // ---------------- USERS ----------------
    if (resource === "users") {
      if (req.method === "GET") {
        const q = url.searchParams.get("q") || "";
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
        if (role) data.role = role;
        if (tier) data.tier = tier;
        if (typeof isVerified === "boolean") {
          data.isVerified = isVerified;
          data.verifiedAt = isVerified ? new Date() : null;
        }

        const user = await prisma.user.update({
          where: { id },
          data,
          select: {
            id: true,
            email: true,
            role: true,
            tier: true,
            isVerified: true,
            verifiedAt: true,
          },
        });

        return res.status(200).json({ user });
      }

      res.setHeader("Allow", "GET, PATCH");
      return res.status(405).json({ message: "Method not allowed" });
    }

    // ---------------- LISTINGS ----------------
    if (resource === "listings") {
      if (req.method === "GET") {
        const platform = url.searchParams.get("platform");
        const categoryId = url.searchParams.get("categoryId");
        const status = url.searchParams.get("status");
        const q = url.searchParams.get("q") || "";

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

        const listing = await prisma.listing.update({
          where: { id },
          data: { ...(body.status ? { status: body.status } : {}) },
        });

        return res.status(200).json({ listing });
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

    // ---------------- FEED ----------------
    if (resource === "feed") {
      const allowedTags = new Set(["NEW", "UPDATE", "CHANGELOG"]);

      if (req.method === "GET") {
        const q = (url.searchParams.get("q") || "").toString();

        const posts = await prisma.feedPost.findMany({
          where: q
            ? {
                OR: [
                  { title: { contains: q, mode: "insensitive" } },
                  { body: { contains: q, mode: "insensitive" } },
                  { category: { contains: q, mode: "insensitive" } },
                ],
              }
            : {},
          orderBy: { createdAt: "desc" },
          take: 200,
          include: {
            author: { select: { id: true, username: true, isVerified: true, tier: true } },
          },
        });

        return res.status(200).json({ posts });
      }

      if (req.method === "POST") {
        const body = readJson(req);

        const title = String(body.title || "").trim();
        const text = String(body.body || "").trim();
        const image = body.image ? String(body.image).trim() : null;
        const category = body.category ? String(body.category).trim() : null;

        const tagsRaw = Array.isArray(body.tags) ? body.tags.map((t) => String(t).toUpperCase()) : [];
        const tags = tagsRaw.filter((t) => allowedTags.has(t)).slice(0, 5);

        if (!title || !text) return res.status(400).json({ message: "Missing title/body" });

        const created = await prisma.feedPost.create({
          data: {
            title,
            body: text,
            image,
            category,
            tags,
            authorId: adminUid,
          },
          include: {
            author: { select: { id: true, username: true, isVerified: true, tier: true } },
          },
        });

        return res.status(201).json({ post: created });
      }

      if (req.method === "PATCH") {
        if (!id) return res.status(400).json({ message: "Missing feed post id" });

        const body = readJson(req);

        const tags =
          body.tags !== undefined
            ? (Array.isArray(body.tags) ? body.tags.map((t) => String(t).toUpperCase()) : [])
                .filter((t) => allowedTags.has(t))
                .slice(0, 5)
            : undefined;

        const updated = await prisma.feedPost.update({
          where: { id },
          data: {
            ...(body.title !== undefined ? { title: String(body.title).trim() } : {}),
            ...(body.body !== undefined ? { body: String(body.body).trim() } : {}),
            ...(body.image !== undefined ? { image: body.image ? String(body.image).trim() : null } : {}),
            ...(body.category !== undefined ? { category: body.category ? String(body.category).trim() : null } : {}),
            ...(tags !== undefined ? { tags } : {}),
          },
          include: {
            author: { select: { id: true, username: true, isVerified: true, tier: true } },
          },
        });

        return res.status(200).json({ post: updated });
      }

      if (req.method === "DELETE") {
        if (!id) return res.status(400).json({ message: "Missing feed post id" });

        await prisma.feedPost.delete({ where: { id } });
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