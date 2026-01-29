import { prisma } from "../_lib/prisma.js";
import { requireAuth } from "../_lib/auth.js";
import { stripe } from "../_lib/stripe.js";

export default async function handler(req, res) {
  try {
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
        include: { seller: { select: { id: true, email: true } } },
      });

      return res.status(200).json({ listings });
    }

    if (req.method === "POST") {
      const decoded = await requireAuth(req);
      const body = req.body ? JSON.parse(req.body) : {};

      // Intent: Stripe checkout (kept within allowed endpoint list)
      if (body.intent === "checkout") {
        const listing = await prisma.listing.findUnique({
          where: { id: body.listingId },
          include: { seller: true },
        });

        if (!listing || listing.status !== "ACTIVE") {
          return res.status(404).json({ message: "Listing not available" });
        }

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
                  images: [listing.image],
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

        // You’d normally confirm payment via Stripe webhook.
        // This scaffold stores session id; mark SOLD on webhook later.
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
      const {
        id,
        title,
        platform,
        price,
        description,
        image,
        metrics,
        status,
      } = body;

      if (!title || !platform || !price || !description || !image) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Ensure user exists
      await prisma.user.upsert({
        where: { id: decoded.uid },
        update: { email: decoded.email ?? "unknown" },
        create: { id: decoded.uid, email: decoded.email ?? "unknown" },
      });

      if (id) {
        // Update only if owner
        const existing = await prisma.listing.findUnique({ where: { id } });
        if (!existing || existing.sellerId !== decoded.uid) {
          return res.status(403).json({ message: "Forbidden" });
        }

        const updated = await prisma.listing.update({
          where: { id },
          data: {
            title,
            platform,
            price: Number(price),
            description,
            image,
            metrics: metrics ?? undefined,
            status: status ?? undefined,
          },
        });

        return res.status(200).json({ listing: updated });
      }

      const created = await prisma.listing.create({
        data: {
          title,
          platform,
          price: Number(price),
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