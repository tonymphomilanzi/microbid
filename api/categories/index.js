import { prisma } from "../_lib/prisma.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ message: "Method not allowed" });

    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });

    return res.status(200).json({ categories });
  } catch (e) {
    return res.status(500).json({ message: e.message || "Error" });
  }
}