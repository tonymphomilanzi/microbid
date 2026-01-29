import { prisma } from "./_lib/prisma.js";
import { requireAuth } from "./_lib/auth.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ message: "Method not allowed" });

    const decoded = await requireAuth(req);

    const user = await prisma.user.upsert({
      where: { id: decoded.uid },
      update: { email: decoded.email ?? "unknown" },
      create: { id: decoded.uid, email: decoded.email ?? "unknown" },
      include: {
        listings: { orderBy: { createdAt: "desc" } },
        purchases: {
          orderBy: { createdAt: "desc" },
          include: { listing: true },
        },
        sales: {
          orderBy: { createdAt: "desc" },
          include: { listing: true },
        },
      },
    });

    return res.status(200).json({ user });
  } catch (e) {
    return res.status(e.statusCode ?? 500).json({ message: e.message ?? "Error" });
  }
}