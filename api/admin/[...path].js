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

    const resource = parts[0] || ""; // users | listings | platforms | categories | feed | settings | escrows | streams | pages | plans
    const id = parts[1] || url.searchParams.get("id") || null;

    // nice health response
    if (!resource) {
      return res.status(200).json({
        ok: true,
        resources: ["users", "listings", "platforms", "categories", "feed", "streams", "pages", "settings", "escrows", "plans"],
      });
    }

    // ---------------- SETTINGS (ESCROW + PAYMENT DETAILS) ----------------
    // GET    /api/admin/settings
    // PATCH  /api/admin/settings
    if (resource === "settings") {
      if (req.method === "GET") {
        const settings = await getOrCreateGlobalConfig();
        return res.status(200).json({ settings });
      }

      if (req.method === "PATCH") {
        const body = readJson(req);
        const s = body.settings && typeof body.settings === "object" ? body.settings : body;

        const escrowFeeBps = intOrUndefined(s.escrowFeeBps);
        if (escrowFeeBps !== undefined && (escrowFeeBps < 0 || escrowFeeBps > 2000)) {
          return res.status(400).json({ message: "escrowFeeBps must be between 0 and 2000" });
        }

        const updated = await prisma.appConfig.upsert({
          where: { id: "global" },
          create: {
            id: "global",
            escrowAgentUid: "SYSTEM",
            escrowFeeBps: escrowFeeBps ?? 200,

            companyBtcAddress: strOrNullOrUndefined(s.companyBtcAddress) ?? null,
            companyBtcNetwork: strOrNullOrUndefined(s.companyBtcNetwork) ?? null,
            companyBtcQrUrl: strOrNullOrUndefined(s.companyBtcQrUrl) ?? null, // ✅ NEW

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
            escrowAgentUid: "SYSTEM",
            escrowFeeBps,

            companyBtcAddress: strOrNullOrUndefined(s.companyBtcAddress),
            companyBtcNetwork: strOrNullOrUndefined(s.companyBtcNetwork),
            companyBtcQrUrl: strOrNullOrUndefined(s.companyBtcQrUrl), // ✅ NEW

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

    // ---------------- STREAMS (Short videos) ----------------
    // GET    /api/admin/streams
    // POST   /api/admin/streams
    // PATCH  /api/admin/streams/:id
    // DELETE /api/admin/streams/:id
    if (resource === "streams") {
      if (req.method === "GET") {
        const status = (url.searchParams.get("status") || "").toUpperCase(); // ACTIVE | INACTIVE | ""
        const q = (url.searchParams.get("q") || "").trim();

        const where = {
          ...(status === "ACTIVE" ? { isActive: true } : {}),
          ...(status === "INACTIVE" ? { isActive: false } : {}),
          ...(q
            ? {
                OR: [
                  { title: { contains: q, mode: "insensitive" } },
                  { caption: { contains: q, mode: "insensitive" } },
                  { id: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
        };

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

        return res.status(200).json({ streams });
      }

      if (req.method === "POST") {
        const body = readJson(req);

        const title = String(body.title || "").trim();
        const caption = body.caption ? String(body.caption).trim() : null;
        const coverImageUrl = String(body.coverImageUrl || "").trim();
        const videoUrl = String(body.videoUrl || "").trim();
        const isActive = body.isActive === undefined ? true : Boolean(body.isActive);

        const viewsCountRaw = body.viewsCount;
        const viewsCount =
          viewsCountRaw === undefined || viewsCountRaw === null || viewsCountRaw === ""
            ? 0
            : Math.trunc(Number(viewsCountRaw));

        if (!title) return res.status(400).json({ message: "Missing title" });
        if (!coverImageUrl) return res.status(400).json({ message: "Missing coverImageUrl" });
        if (!videoUrl) return res.status(400).json({ message: "Missing videoUrl" });
        if (!Number.isFinite(viewsCount) || viewsCount < 0) {
          return res.status(400).json({ message: "viewsCount must be a non-negative integer" });
        }

        const created = await prisma.streamVideo.create({
          data: {
            title,
            caption,
            coverImageUrl,
            videoUrl,
            isActive,
            viewsCount,
            createdById: adminUid,
          },
        });

        return res.status(201).json({ stream: created });
      }

      if (req.method === "PATCH") {
        if (!id) return res.status(400).json({ message: "Missing stream id" });
        const body = readJson(req);

        const data = {};

        if (body.title !== undefined) data.title = String(body.title || "").trim();
        if (body.caption !== undefined) data.caption = body.caption ? String(body.caption).trim() : null;
        if (body.coverImageUrl !== undefined) data.coverImageUrl = String(body.coverImageUrl || "").trim();
        if (body.videoUrl !== undefined) data.videoUrl = String(body.videoUrl || "").trim();
        if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

        if (body.viewsCount !== undefined) {
          const v = Math.trunc(Number(body.viewsCount));
          if (!Number.isFinite(v) || v < 0) {
            return res.status(400).json({ message: "viewsCount must be a non-negative integer" });
          }
          data.viewsCount = v;
        }

        const stream = await prisma.streamVideo.update({
          where: { id },
          data,
        });

        return res.status(200).json({ stream });
      }

      if (req.method === "DELETE") {
        if (!id) return res.status(400).json({ message: "Missing stream id" });

        await prisma.streamVideo.delete({ where: { id } });
        return res.status(200).json({ ok: true });
      }

      res.setHeader("Allow", "GET, POST, PATCH, DELETE");
      return res.status(405).json({ message: "Method not allowed" });
    }

    // ---------------- PAGES (CMS) ----------------
    // GET    /api/admin/pages
    // GET    /api/admin/pages/<id>
    // POST   /api/admin/pages
    // PATCH  /api/admin/pages/<id>
    // DELETE /api/admin/pages/<id>
    if (resource === "pages") {
      const isValidSlug = (s) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);

      if (req.method === "GET") {
        // If id present => return one page (includes body)
        if (id) {
          const page = await prisma.sitePage.findUnique({
            where: { id },
          });
          if (!page) return res.status(404).json({ message: "Not found" });
          return res.status(200).json({ page });
        }

        // else list pages
        const q = (url.searchParams.get("q") || "").trim();
        const pages = await prisma.sitePage.findMany({
          where: q
            ? {
                OR: [
                  { slug: { contains: q, mode: "insensitive" } },
                  { title: { contains: q, mode: "insensitive" } },
                ],
              }
            : {},
          orderBy: { updatedAt: "desc" },
          take: 300,
          select: {
            id: true,
            slug: true,
            title: true,
            isPublished: true,
            updatedAt: true,
            createdAt: true,
          },
        });

        return res.status(200).json({ pages });
      }

      if (req.method === "POST") {
        const body = readJson(req);

        const slug = String(body.slug || "").trim().toLowerCase();
        const title = String(body.title || "").trim();
        const pageBody = body.body === undefined || body.body === null ? "" : String(body.body);
        const isPublished = body.isPublished === undefined ? true : Boolean(body.isPublished);

        if (!slug) return res.status(400).json({ message: "Missing slug" });
        if (!isValidSlug(slug)) {
          return res.status(400).json({ message: "Slug must be lowercase and use only letters, numbers, and hyphens." });
        }
        if (!title) return res.status(400).json({ message: "Missing title" });
        if (pageBody.length > 100_000) return res.status(400).json({ message: "Body too long (max 100000 chars)" });

        const created = await prisma.sitePage.create({
          data: {
            slug,
            title,
            body: pageBody,
            isPublished,
            updatedById: adminUid,
          },
        });

        return res.status(201).json({ page: created });
      }

      if (req.method === "PATCH") {
        if (!id) return res.status(400).json({ message: "Missing page id" });

        const body = readJson(req);
        const data = { updatedById: adminUid };

        if (body.slug !== undefined) {
          const slug = String(body.slug || "").trim().toLowerCase();
          if (!slug) return res.status(400).json({ message: "slug cannot be empty" });
          if (!isValidSlug(slug)) {
            return res.status(400).json({ message: "Slug must be lowercase and use only letters, numbers, and hyphens." });
          }
          data.slug = slug;
        }

        if (body.title !== undefined) {
          const title = String(body.title || "").trim();
          if (!title) return res.status(400).json({ message: "title cannot be empty" });
          data.title = title;
        }

        if (body.body !== undefined) {
          const pageBody = body.body === null ? "" : String(body.body);
          if (pageBody.length > 100_000) return res.status(400).json({ message: "Body too long (max 100000 chars)" });
          data.body = pageBody;
        }

        if (body.isPublished !== undefined) data.isPublished = Boolean(body.isPublished);

        const updated = await prisma.sitePage.update({
          where: { id },
          data,
        });

        return res.status(200).json({ page: updated });
      }

      if (req.method === "DELETE") {
        if (!id) return res.status(400).json({ message: "Missing page id" });
        await prisma.sitePage.delete({ where: { id } });
        return res.status(200).json({ ok: true });
      }

      res.setHeader("Allow", "GET, POST, PATCH, DELETE");
      return res.status(405).json({ message: "Method not allowed" });
    }

    // ---------------- PLANS (Subscriptions) ----------------
    // GET    /api/admin/plans
    // PATCH  /api/admin/plans/<id>
    if (resource === "plans") {
      if (req.method === "GET") {
        const plans = await prisma.plan.findMany({
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        });

        // normalize features to always contain listingsPerMonth + conversationsPerMonth
        const out = plans.map((p) => {
          const f = p.features && typeof p.features === "object" ? p.features : {};
          return {
            ...p,
            features: {
              listingsPerMonth: Number.isFinite(Number(f.listingsPerMonth)) ? Math.trunc(Number(f.listingsPerMonth)) : 0,
              conversationsPerMonth: Number.isFinite(Number(f.conversationsPerMonth))
                ? Math.trunc(Number(f.conversationsPerMonth))
                : 0,
            },
          };
        });

        return res.status(200).json({ plans: out });
      }

      if (req.method === "PATCH") {
        if (!id) return res.status(400).json({ message: "Missing plan id" });

        const body = readJson(req);
        const patch = body && typeof body === "object" ? body : {};

        const existing = await prisma.plan.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ message: "Plan not found" });

        const existingF = existing.features && typeof existing.features === "object" ? existing.features : {};
        const nextFraw = patch.features && typeof patch.features === "object" ? patch.features : {};

        const listingsPerMonth = Number(nextFraw.listingsPerMonth ?? existingF.listingsPerMonth ?? 0);
        const conversationsPerMonth = Number(nextFraw.conversationsPerMonth ?? existingF.conversationsPerMonth ?? 0);

        if (!Number.isFinite(listingsPerMonth) || !Number.isFinite(conversationsPerMonth)) {
          return res.status(400).json({ message: "Invalid features values" });
        }

        const updated = await prisma.plan.update({
          where: { id },
          data: {
            ...(patch.tagline !== undefined ? { tagline: patch.tagline ? String(patch.tagline) : null } : {}),
            ...(patch.highlight !== undefined ? { highlight: Boolean(patch.highlight) } : {}),
            ...(patch.order !== undefined ? { order: Math.trunc(Number(patch.order)) } : {}),
            ...(patch.isActive !== undefined ? { isActive: Boolean(patch.isActive) } : {}),
            features: {
              ...existingF,
              listingsPerMonth: Math.trunc(listingsPerMonth),
              conversationsPerMonth: Math.trunc(conversationsPerMonth),
            },
          },
        });

        return res.status(200).json({ plan: updated });
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

        // If tier changed, also upsert UserSubscription to match that plan
        if (tier) {
          const planName = String(tier).toUpperCase(); // FREE|PRO|VIP
          const plan = await prisma.plan.findUnique({ where: { name: planName } });
          if (plan) {
            await prisma.userSubscription.upsert({
              where: { userId: id },
              create: { userId: id, planId: plan.id, status: "ACTIVE" },
              update: { planId: plan.id, status: "ACTIVE" },
            });
          }
        }

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

    // ---------------- ESCROWS ----------------
    if (resource === "escrows") {
      if (req.method === "GET") {
        const status = url.searchParams.get("status") || "";
        const q = (url.searchParams.get("q") || "").trim();

        const escrows = await prisma.escrowTransaction.findMany({
          where: {
            ...(status ? { status } : {}),
            ...(q
              ? {
                  OR: [
                    { id: { contains: q, mode: "insensitive" } },
                    { listing: { title: { contains: q, mode: "insensitive" } } },
                    { buyerId: { contains: q, mode: "insensitive" } },
                    { sellerId: { contains: q, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
          orderBy: { createdAt: "desc" },
          take: 200,
          include: {
            listing: { select: { id: true, title: true, price: true, status: true, platform: true } },
            proofs: { orderBy: { createdAt: "desc" } },
          },
        });

        return res.status(200).json({ escrows });
      }

      if (req.method === "PATCH") {
        if (!id) return res.status(400).json({ message: "Missing escrow id" });
        const body = readJson(req);

        if (body.intent !== "verifyPayment") {
          return res.status(400).json({ message: "Unsupported intent" });
        }

        const out = await prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`escrow:verify:${id}`}, 0))`;

          const escrow = await tx.escrowTransaction.findUnique({
            where: { id },
            include: { listing: true },
          });

          if (!escrow) {
            const err = new Error("Escrow not found");
            err.statusCode = 404;
            throw err;
          }

          if (!["FEE_PAID", "FULLY_PAID"].includes(escrow.status)) {
            const err = new Error(`Escrow is not ready for verification (status ${escrow.status})`);
            err.statusCode = 400;
            throw err;
          }

          const existingPurchase = await tx.purchase.findFirst({
            where: { listingId: escrow.listingId },
            orderBy: { createdAt: "desc" },
          });

          const alreadyVerified = escrow.status === "FULLY_PAID";
          const canNotify = Boolean(tx.notification);

          const updatedEscrow =
            escrow.status === "FULLY_PAID"
              ? escrow
              : await tx.escrowTransaction.update({
                  where: { id },
                  data: { status: "FULLY_PAID", fundedAt: new Date() },
                });

          await tx.listing.update({
            where: { id: escrow.listingId },
            data: { status: "SOLD" },
          });

          const purchase =
            existingPurchase ||
            (await tx.purchase.create({
              data: {
                listingId: escrow.listingId,
                buyerId: escrow.buyerId,
                sellerId: escrow.sellerId,
                amount: Math.trunc(Number(escrow.priceCents || 0) / 100),
                stripeSessionId: `MANUAL:${escrow.id}`,
              },
            }));

          if (!alreadyVerified && canNotify) {
            const listingTitle = escrow.listing?.title || "a listing";
            const listingUrl = `/listings/${escrow.listingId}`;
            const amountUsd = Math.trunc(Number(escrow.priceCents || 0) / 100);

            await tx.notification.create({
              data: {
                userId: escrow.buyerId,
                type: "PURCHASE_CREATED",
                title: "Purchase confirmed",
                body: `Your purchase for "${listingTitle}" is confirmed.`,
                url: listingUrl,
                meta: {
                  escrowId: escrow.id,
                  listingId: escrow.listingId,
                  purchaseId: purchase.id,
                  amount: amountUsd,
                },
              },
            });

            await tx.notification.create({
              data: {
                userId: escrow.sellerId,
                type: "SALE_CONFIRMED",
                title: "Sale confirmed",
                body: `Buyer payment has been verified for "${listingTitle}". Prepare to transfer ownership.`,
                url: listingUrl,
                meta: {
                  escrowId: escrow.id,
                  listingId: escrow.listingId,
                  purchaseId: purchase.id,
                  amount: amountUsd,
                },
              },
            });

            await tx.notification.create({
              data: {
                userId: escrow.sellerId,
                type: "SALE_MADE",
                title: "You made a sale",
                body: `You sold "${listingTitle}".`,
                url: listingUrl,
                meta: {
                  escrowId: escrow.id,
                  listingId: escrow.listingId,
                  purchaseId: purchase.id,
                  amount: amountUsd,
                },
              },
            });
          }

          return { escrow: updatedEscrow, purchase };
        });

        return res.status(200).json(out);
      }

      res.setHeader("Allow", "GET, PATCH");
      return res.status(405).json({ message: "Method not allowed" });
    }

    return res.status(404).json({ message: "Unknown admin resource" });
  } catch (e) {
    return res.status(e.statusCode ?? 500).json({ message: e.message ?? "Error" });
  }
}