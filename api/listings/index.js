import { prisma } from "../_lib/prisma.js";
import { requireAuth } from "../_lib/auth.js";
import { getStripe } from "../_lib/stripe.js";

function readJson(req) {
  const b = req.body;

  if (!b) return {};
  if (typeof b === "object") return b; // Vercel often parses JSON automatically
  if (Buffer.isBuffer(b)) return JSON.parse(b.toString("utf8"));
  if (typeof b === "string") return JSON.parse(b);

  return {};
}

export default async function handler(req, res) {
  try {
    // -------------------------
    // GET /api/listings (public)
    // -------------------------
    if (req.method === "GET") {
      const { platform, q, minPrice, maxPrice } = req.query;

      const where = {
        status: "ACTIVE",
        ...(platform ? { platform } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(minPrice || maxPrice
          ? {
              price: {
                ...(minPrice ? { gte: Number(minPrice) } : {}),
                ...(maxPrice ? { lte: Number(maxPrice) } : {}),
              },
            }
          : {}),
      };

      const listings = await prisma.listing.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { seller: { select: { id: true, email: true, isVerified: true, tier: true } } },
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

        if (!listingId) {
          return res.status(400).json({ message: "Missing listingId" });
        }

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

        // Note: normally you confirm payment via Stripe webhook.
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

      // Create / Update (Upsert) listing
      const { id, title, platform, price, description, image, metrics, status } = body;

      const numericPrice = Number(price);

      if (!title || !platform || !description || !image || !Number.isFinite(numericPrice) || numericPrice <= 0) {
        return res.status(400).json({ message: "Missing/invalid required fields" });
      }

      // Ensure user exists
      await prisma.user.upsert({
        where: { id: decoded.uid },
        update: { email: decoded.email ?? "unknown" },
        create: { id: decoded.uid, email: decoded.email ?? "unknown" },
      });

      // Update
      if (id) {
        const existing = await prisma.listing.findUnique({ where: { id } });

        if (!existing) return res.status(404).json({ message: "Listing not found" });
        if (existing.sellerId !== decoded.uid) {
          return res.status(403).json({ message: "Forbidden" });
        }

        const updated = await prisma.listing.update({
          where: { id },
          data: {
            title,
            platform,
            price: numericPrice,
            description,
            image,
            metrics: metrics ?? undefined,
            status: status ?? undefined,
          },
        });

        return res.status(200).json({ listing: updated });
      }

      // Create
      const created = await prisma.listing.create({
        data: {
          title,
          platform,
          price: numericPrice,
          description,
          image,
          metrics: metrics ?? null,
          sellerId: decoded.uid,
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
