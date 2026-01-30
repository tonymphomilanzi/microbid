import { prisma } from "../_lib/prisma.js";
import { requireAuth } from "../_lib/auth.js";
import { computeServiceFee } from "../_lib/fees.js";

function readJson(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === "object") return b;
  if (Buffer.isBuffer(b)) return JSON.parse(b.toString("utf8"));
  if (typeof b === "string") return JSON.parse(b);
  return {};
}

async function completedDealsCount(userId) {
  return prisma.escrowTransaction.count({
    where: {
      status: "RELEASED",
      OR: [{ buyerId: userId }, { sellerId: userId }],
    },
  });
}

export default async function handler(req, res) {
  try {
    const decoded = await requireAuth(req);
    const uid = decoded.uid;

    if (req.method === "GET") {
      const escrows = await prisma.escrowTransaction.findMany({
        where: { OR: [{ buyerId: uid }, { sellerId: uid }] },
        orderBy: { createdAt: "desc" },
        include: {
          listing: { select: { id: true, title: true, platform: true, image: true } },
        },
      });
      return res.status(200).json({ escrows });
    }

    if (req.method === "POST") {
      const body = readJson(req);
      const { listingId, mode, provider } = body;

      if (!listingId || !mode || !provider) {
        return res.status(400).json({ message: "Missing listingId/mode/provider" });
      }

      if (!["FASTEST", "SAFEST"].includes(mode)) {
        return res.status(400).json({ message: "Invalid mode" });
      }

      // manual-first: allow these now
      const allowedProviders = ["MANUAL", "MOMO", "BTC", "PAYPAL"];
      if (!allowedProviders.includes(provider)) {
        return res.status(400).json({ message: "Provider not enabled yet" });
      }

      const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        include: { seller: { select: { id: true, email: true, tier: true, isVerified: true } } },
      });

      if (!listing) return res.status(404).json({ message: "Listing not found" });
      if (listing.status !== "ACTIVE") return res.status(400).json({ message: "Listing not active" });
      if (listing.sellerId === uid) return res.status(400).json({ message: "You cannot buy your own listing" });

      // ensure buyer exists
      const buyer = await prisma.user.upsert({
        where: { id: uid },
        update: { email: decoded.email ?? "unknown" },
        create: { id: uid, email: decoded.email ?? "unknown" },
      });

      const seller = await prisma.user.upsert({
        where: { id: listing.sellerId },
        update: {},
        create: { id: listing.sellerId, email: listing.seller?.email ?? "unknown" },
      });

      const priceCents = listing.price * 100;

      const buyerCompletedDeals = await completedDealsCount(buyer.id);
      const sellerCompletedDeals = await completedDealsCount(seller.id);

      const fee = computeServiceFee({
        priceCents,
        platform: listing.platform,
        buyerTier: buyer.tier,
        sellerTier: seller.tier,
        buyerCompletedDeals,
        sellerCompletedDeals,
      });

      const totalChargeCents = mode === "FASTEST" ? priceCents + fee.feeCents : fee.feeCents;

      const escrowAgentId = process.env.ESCROW_AGENT_UID;
      if (!escrowAgentId) {
        return res.status(500).json({ message: "ESCROW_AGENT_UID is not configured" });
      }

      const created = await prisma.escrowTransaction.create({
        data: {
          listingId: listing.id,
          buyerId: buyer.id,
          sellerId: seller.id,
          escrowAgentId,
          mode,
          provider,
          status: "INITIATED",
          priceCents,
          feeBps: fee.feeBps,
          feeCents: fee.feeCents,
          minFeeCents: fee.minFeeCents,
          discounts: fee.discounts,
          totalChargeCents,
        },
      });

      // For now return basic instructions (you can move this to DB settings later)
      const instructions =
        provider === "MANUAL"
          ? "Manual payment: Admin will provide bank transfer details. Upload payment proof after paying."
          : provider === "MOMO"
          ? "Mobile Money: Pay to the provided number. Upload proof. Admin will confirm."
          : provider === "BTC"
          ? "Bitcoin: Send to our wallet address. Upload TXID. Admin will confirm."
          : "PayPal: Send payment and upload proof. Admin will confirm.";

      return res.status(201).json({
        escrow: created,
        breakdown: {
          priceCents,
          feeCents: fee.feeCents,
          feeBps: fee.feeBps,
          totalChargeCents,
          discounts: fee.discounts,
          minFeeCents: fee.minFeeCents,
        },
        instructions,
      });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ message: "Method not allowed" });
  } catch (e) {
    return res.status(e.statusCode ?? 500).json({ message: e.message ?? "Error" });
  }
}