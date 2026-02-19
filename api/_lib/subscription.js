import { prisma } from "./prisma.js";
import { normalizeFeatures } from "./planFeatures.js";

let seeded = false;

export async function ensureDefaultPlans() {
  if (seeded) return;

  // Upsert so it’s safe to call multiple times
  const defaults = [
    {
      name: "FREE",
      billingType: "FREE",
      monthlyPriceCents: 0,
      oneTimePriceCents: 0,
      features: { listingsPerMonth: 3, conversationsPerMonth: 5 },
      tagline: "Starter",
      highlight: false,
      order: 1,
      isActive: true,
    },
    {
      name: "PRO",
      billingType: "MONTHLY",
      monthlyPriceCents: 1999,
      oneTimePriceCents: 0,
      features: { listingsPerMonth: 20, conversationsPerMonth: 50 },
      tagline: "Grow faster",
      highlight: true,
      order: 2,
      isActive: true,
    },
    {
      name: "VIP",
      billingType: "LIFETIME",
      monthlyPriceCents: 0,
      oneTimePriceCents: 9900,
      features: { listingsPerMonth: -1, conversationsPerMonth: -1 }, // unlimited
      tagline: "Unlimited",
      highlight: false,
      order: 3,
      isActive: true,
    },
  ];

  for (const p of defaults) {
    await prisma.plan.upsert({
      where: { name: p.name },
      create: p,
      update: {
        billingType: p.billingType,
        monthlyPriceCents: p.monthlyPriceCents,
        oneTimePriceCents: p.oneTimePriceCents,
        features: p.features,
        tagline: p.tagline,
        highlight: p.highlight,
        order: p.order,
        isActive: p.isActive,
      },
    });
  }

  seeded = true;
}

/**
 * Returns:
 *  - user (role,tier)
 *  - plan (DB plan or virtual ADMIN plan)
 *  - features (normalized)
 */
export async function getEffectivePlanForUser(tx, userId) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, tier: true },
  });
  if (!user) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  // ADMIN unlimited always
  if (user.role === "ADMIN") {
    return {
      user,
      plan: {
        id: "ADMIN",
        name: "ADMIN",
        billingType: "FREE",
        monthlyPriceCents: 0,
        oneTimePriceCents: 0,
        features: { listingsPerMonth: -1, conversationsPerMonth: -1 },
        tagline: "Unlimited",
        highlight: true,
        order: -1,
        isActive: true,
        createdAt: new Date(),
      },
      features: { listingsPerMonth: -1, conversationsPerMonth: -1 },
    };
  }

  // Use subscription first
  const sub = await tx.userSubscription.findUnique({
    where: { userId },
    include: { plan: true },
  });

  if (sub?.plan) {
    return {
      user,
      plan: sub.plan,
      features: normalizeFeatures(sub.plan.features),
    };
  }

  // Fallback: map user.tier => Plan.name
  const tierName = String(user.tier || "FREE").toUpperCase();
  const planByTier = await tx.plan.findUnique({ where: { name: tierName } });

  if (planByTier) {
    return { user, plan: planByTier, features: normalizeFeatures(planByTier.features) };
  }

  // final fallback FREE
  const free = await tx.plan.findUnique({ where: { name: "FREE" } });
  if (!free) {
    const err = new Error('Missing plan "FREE"');
    err.statusCode = 500;
    throw err;
  }

  return { user, plan: free, features: normalizeFeatures(free.features) };
}