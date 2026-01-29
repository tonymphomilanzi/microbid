import { prisma } from "../_lib/prisma.js";
import { requireAuth } from "../_lib/auth.js";

export default async function handler(req, res) {

  
  try {
    const rawId = req.query?.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id) return res.status(400).json({ message: "Missing listing id" });

    if (req.method === "GET") {
      const listing = await prisma.listing.findUnique({
        where: { id },
        include: { seller: { select: { id: true, email: true } } },
      });

      if (!listing) return res.status(404).json({ message: "Not found" });
      return res.status(200).json({ listing });
    }

    if (req.method === "DELETE") {
      const decoded = await requireAuth(req);

      const listing = await prisma.listing.findUnique({ where: { id } });
      if (!listing) return res.status(404).json({ message: "Not found" });
      if (listing.sellerId !== decoded.uid) return res.status(403).json({ message: "Forbidden" });

      await prisma.listing.delete({ where: { id } });
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, DELETE");
    return res.status(405).json({ message: "Method not allowed" });
  } catch (e) {
    return res.status(e.statusCode ?? 500).json({ message: e.message ?? "Error" });
  }
}