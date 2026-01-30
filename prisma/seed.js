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
}

main()
  .finally(async () => prisma.$disconnect());