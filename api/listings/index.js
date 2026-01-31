import { prisma } from "../_lib/prisma.js";
import { requireAuth } from "../_lib/auth.js";
import { getStripe } from "../_lib/stripe.js";

function readJson(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === "object") return b;
  if (Buffer.isBuffer(b)) return JSON.parse(b.toString("utf8"));
  if (typeof b === "string") return JSON.parse(b);
  return {};
}

function toNumberOrUndefined(v) {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function cleanImageList(arr) {
  const list = Array.isArray(arr) ? arr : [];
  const cleaned = list
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);

  // remove duplicates while preserving order
  const seen = new Set();
  const uniq = [];
  for (const u of cleaned) {
    if (!seen.has(u)) {
      seen.add(u);
      uniq.push(u);
    }
  }
  return uniq;
}

export default async function handler(req, res) {
  try {
    // -------------------------
    // GET /api/listings (public)
    // -------------------------
    if (req.method === "GET") {
      const { platform, categoryId, q, minPrice, maxPrice } = req.query;

      const minP = toNumberOrUndefined(minPrice);
      const maxP = toNumberOrUndefined(maxPrice);

      const where = {
        status: "ACTIVE",
        ...(platform ? { platform } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(minP !== undefined || maxP !== undefined
          ? {
              price: {
                ...(minP !== undefined ? { gte: minP } : {}),
                ...(maxP !== undefined ? { lte: maxP } : {}),
              },
            }
          : {}),
      };

      const listings = await prisma.listing.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          seller: {
            select: { id: true, email: true, username: true, isVerified: true, tier: true },
          },
          category: true,
        },
      });

      return res.status(200).json({ listings });
    }

    // --------------------------
    // POST /api/listings (auth)
    // - Create/Update listing
    // - intent=checkout (Stripe)
    // --------------------------
    if (req.method === "POST") {
      const decoded = await requireAuth(req);
      const body = readJson(req);

      // Intent: Stripe checkout (kept within allowed endpoint list)
      if (body.intent === "checkout") {
        const listingId = body.listingId;
        if (!listingId) return res.status(400).json({ message: "Missing listingId" });

        const listing = await prisma.listing.findUnique({
          where: { id: listingId },
          include: { seller: true },
        });

        if (!listing || listing.status !== "ACTIVE") {
          return res.status(404).json({ message: "Listing not available" });
        }

        const stripe = getStripe();

        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          success_url: process.env.STRIPE_SUCCESS_URL,
          cancel_url: process.env.STRIPE_CANCEL_URL,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: listing.price * 100,
                product_data: {
                  name: listing.title,
                  images: listing.image ? [listing.image] : [],
                },
              },
            },
          ],
          metadata: {
            listingId: listing.id,
            buyerId: decoded.uid,
            sellerId: listing.sellerId,
          },
        });

        // Note: normally confirm payment via Stripe webhook.
        await prisma.purchase.create({
          data: {
            listingId: listing.id,
            buyerId: decoded.uid,
            sellerId: listing.sellerId,
            amount: listing.price,
            stripeSessionId: session.id,
          },
        });

        return res.status(200).json({ checkoutUrl: session.url });
      }

      // Create / Update listing
      const {
        id,
        title,
        platform,
        categoryId,
        price,
        description,
        image,    // cover image (optional if images[0] provided)
        images,   // array (optional)
        metrics,
        status,
      } = body;

      const numericPrice = Number(price);

      if (!title || !platform || !description || !Number.isFinite(numericPrice) || numericPrice <= 0) {
        return res.status(400).json({ message: "Missing/invalid required fields" });
      }

      // Ensure user exists + get role (for admin-only categories)
      const dbUser = await prisma.user.upsert({
        where: { id: decoded.uid },
        update: { email: decoded.email ?? "unknown" },
        create: { id: decoded.uid, email: decoded.email ?? "unknown" },
        select: { id: true, role: true },
      });

      // Validate platform is active (admin-managed platforms list)
      const platformRow = await prisma.platform.findFirst({
        where: { name: platform, isActive: true },
        select: { id: true },
      });

      if (!platformRow) {
        return res.status(400).json({ message: "Invalid or inactive platform" });
      }

      // Validate category if provided + enforce admin-only
      let categoryToSet = null;
      if (categoryId) {
        const cat = await prisma.category.findUnique({
          where: { id: categoryId },
          select: { id: true, isActive: true, isAdminOnly: true },
        });

        if (!cat || !cat.isActive) return res.status(400).json({ message: "Invalid category" });
        if (cat.isAdminOnly && dbUser.role !== "ADMIN") {
          return res.status(403).json({ message: "This category is admin-only" });
        }
        categoryToSet = cat.id;
      }

      // Build final image gallery (max 6)
      const extraImages = cleanImageList(images);
      const cover = typeof image === "string" && image.trim() ? image.trim() : extraImages[0];

      if (!cover) {
        return res.status(400).json({ message: "Missing cover image" });
      }

      const finalImages = cleanImageList([cover, ...extraImages]).slice(0, 6);

      if (finalImages.length === 0) {
        return res.status(400).json({ message: "Missing images" });
      }

      // Update
      if (id) {
        const existing = await prisma.listing.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ message: "Listing not found" });
        if (existing.sellerId !== decoded.uid) return res.status(403).json({ message: "Forbidden" });

        const updated = await prisma.listing.update({
          where: { id },
          data: {
            title,
            platform,
            categoryId: categoryToSet,
            price: numericPrice,
            description,
            image: finalImages[0],
            images: finalImages,
            metrics: metrics ?? undefined,
            status: status ?? undefined,
          },
          include: {
            seller: {
              select: { id: true, email: true, username: true, isVerified: true, tier: true },
            },
            category: true,
          },
        });

        return res.status(200).json({ listing: updated });
      }

      // Create
      const created = await prisma.listing.create({
        data: {
          title,
          platform,
          categoryId: categoryToSet,
          price: numericPrice,
          description,
          image: finalImages[0],
          images: finalImages,
          metrics: metrics ?? null,
          sellerId: decoded.uid,
        },
        include: {
          seller: {
            select: { id: true, email: true, username: true, isVerified: true, tier: true },
          },
          category: true,
        },
      });

      return res.status(201).json({ listing: created });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ message: "Method not allowed" });
  } catch (e) {
    return res.status(e.statusCode ?? 500).json({ message: e.message ?? "Error" });
  }
}