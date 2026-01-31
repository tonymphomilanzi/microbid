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

    const rawId = req.query?.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (req.method === "DELETE") {
      await prisma.listing.delete({ where: { id } });
      return res.status(200).json({ ok: true });
    }

    if (req.method === "PATCH") {
      const body = readJson(req);
      const { status } = body;

      const updated = await prisma.listing.update({
        where: { id },
        data: { ...(status ? { status } : {}) },
      });

      return res.status(200).json({ listing: updated });
    }

    res.setHeader("Allow", "PATCH, DELETE");
    return res.status(405).json({ message: "Method not allowed" });
  } catch (e) {
    return res.status(e.statusCode ?? 500).json({ message: e.message ?? "Error" });
  }
}