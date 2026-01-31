import { prisma } from "../../_lib/prisma.js";
import { requireAdmin } from "../../_lib/adminOnly.js";

function readJson(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === "object") return b;
  if (Buffer.isBuffer(b)) return JSON.parse(b.toString("utf8"));
  if (typeof b === "string") return JSON.parse(b);
  return {};
}

export default async function handler(req, res) {
  try {
    await requireAdmin(req);

    if (req.method === "GET") {
      const platforms = await prisma.platform.findMany({
        orderBy: [{ order: "asc" }, { name: "asc" }],
      });
      return res.status(200).json({ platforms });
    }

    if (req.method === "POST") {
      const { name, slug, order, isActive } = readJson(req);
      if (!name || !slug) return res.status(400).json({ message: "Missing name/slug" });

      const created = await prisma.platform.create({
        data: { name, slug, order: Number(order ?? 0), isActive: Boolean(isActive ?? true) },
      });

      return res.status(201).json({ platform: created });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ message: "Method not allowed" });
  } catch (e) {
    return res.status(e.statusCode ?? 500).json({ message: e.message ?? "Error" });
  }
}