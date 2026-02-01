import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.platform.createMany({
    data: [
      { name: "YouTube", slug: "youtube", order: 1, isActive: true },
      { name: "Instagram", slug: "instagram", order: 2, isActive: true },
      { name: "TikTok", slug: "tiktok", order: 3, isActive: true },
      { name: "X", slug: "x", order: 4, isActive: true },
      { name: "Facebook", slug: "facebook", order: 5, isActive: true },
      { name: "Telegram", slug: "telegram", order: 6, isActive: true }
    ],
    skipDuplicates: true
  });

  await prisma.category.createMany({
    data: [
      { name: "All", slug: "all", order: 0, isActive: true, isAdminOnly: false },
      { name: "Gaming", slug: "gaming", order: 1, isActive: true, isAdminOnly: false },
      { name: "Finance", slug: "finance", order: 2, isActive: true, isAdminOnly: false },
      { name: "Streaming Kit", slug: "streaming-kit", order: 999, isActive: true, isAdminOnly: true }
    ],
    skipDuplicates: true
  });


async function upsertPlan(name, data) {
  return prisma.plan.upsert({
    where: { name },
    update: data,
    create: { name, ...data },
  });
}

  await upsertPlan("FREE", {
    billingType: "FREE",
    monthlyPriceCents: 0,
    oneTimePriceCents: 0,
    features: { listingsPerMonth: 3, conversationsPerMonth: 5 },
    tagline: "Start selling",
    highlight: false,
    order: 1,
    isActive: true,
  });

  await upsertPlan("PRO", {
    billingType: "MONTHLY",
    monthlyPriceCents: 1500, // $15/mo (change later in admin)
    oneTimePriceCents: 0,
    features: { listingsPerMonth: 10, conversationsPerMonth: 50 },
    tagline: "For serious sellers",
    highlight: true,
    order: 2,
    isActive: true,
  });

  await upsertPlan("VIP", {
    billingType: "LIFETIME",
    monthlyPriceCents: 0,
    oneTimePriceCents: 19900, // $199 lifetime (change later in admin)
    features: { listingsPerMonth: 50, conversationsPerMonth: 200 },
    tagline: "Lifetime access + best discounts",
    highlight: false,
    order: 3,
    isActive: true,
  });



}

main()
  .finally(async () => prisma.$disconnect());