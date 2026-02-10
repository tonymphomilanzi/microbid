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

function viewerKeyFrom(req, uid) {
  if (uid) return `u:${uid}`;
  const did = String(req.headers["x-device-id"] || "").trim();
  return did ? `d:${did}` : null;
}

// returns true if a NEW view row was created, false if already existed
async function recordListingView(listingId, viewerKey) {
  if (!viewerKey) return false;

  try {
    await prisma.listingView.create({ data: { listingId, viewerKey } });
    return true;
  } catch (e) {
    // unique constraint => already viewed
    if (e?.code === "P2002") return false;
    throw e;
  }
}

export default async function handler(req, res) {
  try {
    const rawId = req.query?.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id) return res.status(400).json({ message: "Missing listing id" });

    if (req.method === "GET") {
      const uid = await optionalAuthUid(req); // null if not logged in
      const vKey = viewerKeyFrom(req, uid);

      const listing = await prisma.listing.findUnique({
        where: { id },
        include: {
          seller: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              lastActiveAt: true,
              isVerified: true,
              tier: true,
            },
          },
          category: true,

          _count: { select: { likes: true, comments: true, views: true } },

          // likedByMe (only if logged in)
          ...(uid ? { likes: { where: { userId: uid }, select: { id: true } } } : {}),
        },
      });

      if (!listing) return res.status(404).json({ message: "Not found" });

      // record unique view (don’t count seller’s own view)
      let createdView = false;
      if (!(uid && uid === listing.sellerId)) {
        createdView = await recordListingView(id, vKey);
      }

      // Ensure images always exists in response (backward compatibility)
      const images =
        Array.isArray(listing.images) && listing.images.length
          ? listing.images
          : listing.image
            ? [listing.image]
            : [];

      const baseViewCount = listing._count?.views ?? 0;
      const viewCount = createdView ? baseViewCount + 1 : baseViewCount;

      const safeListing = {
        ...listing,
        images,

        likeCount: listing._count?.likes ?? 0,
        commentCount: listing._count?.comments ?? 0,
        viewCount, // include views

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