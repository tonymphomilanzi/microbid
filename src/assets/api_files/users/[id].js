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

    if (req.method !== "PATCH") {
      res.setHeader("Allow", "PATCH");
      return res.status(405).json({ message: "Method not allowed" });
    }

    const body = readJson(req);
    const { role, tier, isVerified } = body;

    const data = {};
    if (role) data.role = role; // "USER" | "ADMIN"
    if (tier) data.tier = tier; // "FREE" | "PRO" | "VIP"
    if (typeof isVerified === "boolean") {
      data.isVerified = isVerified;
      data.verifiedAt = isVerified ? new Date() : null;
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        role: true,
        tier: true,
        isVerified: true,
        verifiedAt: true,
      },
    });

    return res.status(200).json({ user: updated });
  } catch (e) {
    return res.status(e.statusCode ?? 500).json({ message: e.message ?? "Error" });
  }
}