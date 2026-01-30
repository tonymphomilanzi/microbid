import { requireAuth } from "./auth.js";
import { prisma } from "./prisma.js";

export async function requireAdmin(req) {
  const decoded = await requireAuth(req);
  const user = await prisma.user.findUnique({ where: { id: decoded.uid } });

  if (!user || user.role !== "ADMIN") {
    const err = new Error("Admin only");
    err.statusCode = 403;
    throw err;
  }

  return { decoded, user };
}