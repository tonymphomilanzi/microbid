import { prisma } from "../../_lib/prisma.js";
import { requireAdmin } from "../../_lib/adminOnly.js";

export default async function handler(req, res) {
  try {
    await requireAdmin(req);

    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ message: "Method not allowed" });
    }

    const { platform, categoryId, status, q } = req.query;

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
  } catch (e) {
    return res.status(e.statusCode ?? 500).json({ message: e.message ?? "Error" });
  }
}