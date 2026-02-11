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

function deviceIdFrom(req) {
  const did = String(req.headers["x-device-id"] || "").trim();
  return did || null;
}

// Smart merge: device view -> user view (prevents double count on refresh)
async function recordListingViewSmart(listingId, uid, deviceId) {
  const uKey = uid ? `u:${uid}` : null;
  const dKey = deviceId ? `d:${deviceId}` : null;

  if (uKey) {
    if (dKey) {
      const existingDevice = await prisma.listingView.findUnique({
        where: { listingId_viewerKey: { listingId, viewerKey: dKey } },
        select: { id: true },
      });

      if (existingDevice) {
        try {
          await prisma.listingView.update({
            where: { listingId_viewerKey: { listingId, viewerKey: dKey } },
            data: { viewerKey: uKey },
          });
        } catch (e) {
          if (e?.code === "P2002") {
            await prisma.listingView
              .delete({ where: { listingId_viewerKey: { listingId, viewerKey: dKey } } })
              .catch(() => {});
          } else {
            throw e;
          }
        }
        return false;
      }
    }

    try {
      await prisma.listingView.create({ data: { listingId, viewerKey: uKey } });
      return true;
    } catch (e) {
      if (e?.code === "P2002") return false;
      throw e;
    }
  }

  if (dKey) {
    try {
      await prisma.listingView.create({ data: { listingId, viewerKey: dKey } });
      return true;
    } catch (e) {
      if (e?.code === "P2002") return false;
      throw e;
    }
  }

  return false;
}

export default async function handler(req, res) {
  try {
    const rawId = req.query?.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id) return res.status(400).json({ message: "Missing listing id" });

    if (req.method === "GET") {
      const uid = await optionalAuthUid(req);
      const deviceId = deviceIdFrom(req);

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
          ...(uid ? { likes: { where: { userId: uid }, select: { id: true } } } : {}),
        },
      });

      if (!listing) return res.status(404).json({ message: "Not found" });

      const createdView =
        !(uid && uid === listing.sellerId)
          ? await recordListingViewSmart(id, uid, deviceId)
          : false;

      const images =
        Array.isArray(listing.images) && listing.images.length
          ? listing.images
          : listing.image
            ? [listing.image]
            : [];

      const baseViews = listing._count?.views ?? 0;
      const viewCount = createdView ? baseViews + 1 : baseViews;

      const safeListing = {
        ...listing,
        images,
        likeCount: listing._count?.likes ?? 0,
        commentCount: listing._count?.comments ?? 0,
        viewCount,
        likedByMe: uid ? (listing.likes?.length ?? 0) > 0 : false,
      };

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