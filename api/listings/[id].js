import { prisma } from "../_lib/prisma.js";
import { requireAuth } from "../_lib/auth.js";

async function optionalAuthUid(req) {
  try {
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) return null;
    const decoded = await requireAuth(req);
    return decoded?.uid || null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    const rawId = req.query?.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id) return res.status(400).json({ message: "Missing listing id" });

    if (req.method === "GET") {
      const uid = await optionalAuthUid(req); // null if not logged in

      const listing = await prisma.listing.findUnique({
        where: { id },
        include: {
          seller: {
            // do NOT return email publicly
            select: { id: true, username: true, avatarUrl: true, isVerified: true, tier: true },
          },
          category: true,

          // counts for likes/comments
          _count: { select: { likes: true, comments: true } },

          // likedByMe (only if logged in)
          ...(uid ? { likes: { where: { userId: uid }, select: { id: true } } } : {}),
        },
      });

      if (!listing) return res.status(404).json({ message: "Not found" });

      // Ensure images always exists in response (backward compatibility)
      const images =
        Array.isArray(listing.images) && listing.images.length
          ? listing.images
          : listing.image
            ? [listing.image]
            : [];

      const safeListing = {
        ...listing,
        images,

        // flatten counts into fields your UI can use
        likeCount: listing._count?.likes ?? 0,
        commentCount: listing._count?.comments ?? 0,
        likedByMe: uid ? (listing.likes?.length ?? 0) > 0 : false,
      };

      // remove prisma internal fields from response
      delete safeListing._count;
      if (safeListing.likes) delete safeListing.likes;

      return res.status(200).json({ listing: safeListing });
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