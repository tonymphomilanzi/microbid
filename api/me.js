import { prisma } from "./_lib/prisma.js";
import { requireAuth } from "./_lib/auth.js";

function readJson(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === "object") return b;
  if (Buffer.isBuffer(b)) return JSON.parse(b.toString("utf8"));
  if (typeof b === "string") return JSON.parse(b);
  return {};
}

function q1(v) {
  return Array.isArray(v) ? v[0] : v;
}

function normalizeUsername(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

function isValidUsername(u) {
  return /^[a-z0-9_]{3,20}$/.test(u);
}

async function usernameAvailable(username, currentUid) {
  const existing = await prisma.user.findFirst({
    where: {
      username,
      ...(currentUid ? { NOT: { id: currentUid } } : {}),
    },
    select: { id: true },
  });
  return !existing;
}

function buildSuggestions(base) {
  const out = [];
  const stamp = new Date().getFullYear().toString().slice(2);
  out.push(`${base}_${stamp}`);
  out.push(`${base}_${Math.floor(100 + Math.random() * 900)}`);
  out.push(`${base}_${Math.floor(1000 + Math.random() * 9000)}`);
  return out.slice(0, 3);
}

function monthKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

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

// returns true only if NEW unique view added
async function recordFeedViewSmart(postId, uid, deviceId) {
  const uKey = uid ? `u:${uid}` : null;
  const dKey = deviceId ? `d:${deviceId}` : null;

  if (uKey) {
    if (dKey) {
      const existingDevice = await prisma.feedPostView.findUnique({
        where: { postId_viewerKey: { postId, viewerKey: dKey } },
        select: { id: true },
      });

      if (existingDevice) {
        try {
          await prisma.feedPostView.update({
            where: { postId_viewerKey: { postId, viewerKey: dKey } },
            data: { viewerKey: uKey },
          });
        } catch (e) {
          if (e?.code === "P2002") {
            await prisma.feedPostView
              .delete({ where: { postId_viewerKey: { postId, viewerKey: dKey } } })
              .catch(() => {});
          } else {
            throw e;
          }
        }
        return false;
      }
    }

    try {
      await prisma.feedPostView.create({ data: { postId, viewerKey: uKey } });
      return true;
    } catch (e) {
      if (e?.code === "P2002") return false;
      throw e;
    }
  }

  if (dKey) {
    try {
      await prisma.feedPostView.create({ data: { postId, viewerKey: dKey } });
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
    // PUBLIC username availability
    const check = q1(req.query?.checkUsername);
    if (req.method === "GET" && check) {
      const normalized = normalizeUsername(check);

      if (!isValidUsername(normalized)) {
        return res.status(200).json({
          available: false,
          normalized,
          reason: "Username must be 3-20 chars: a-z, 0-9, underscore.",
          suggestions: [],
        });
      }

      let currentUid = null;
      try {
        const header = req.headers.authorization || "";
        if (header.startsWith("Bearer ")) {
          const decoded = await requireAuth(req);
          currentUid = decoded.uid;
        }
      } catch {
        currentUid = null;
      }

      const available = await usernameAvailable(normalized, currentUid);

      let suggestions = [];
      if (!available) {
        const candidates = buildSuggestions(normalized);
        const filtered = [];
        for (const candidate of candidates) {
          if (await usernameAvailable(candidate, null)) filtered.push(candidate);
        }
        suggestions = filtered;
      }

      return res.status(200).json({ available, normalized, suggestions });
    }

    // PUBLIC plans
    if (req.method === "GET" && q1(req.query?.public) === "plans") {
      const plans = await prisma.plan.findMany({
        where: { isActive: true },
        orderBy: [{ order: "asc" }, { name: "asc" }],
      });
      return res.status(200).json({ plans });
    }

    // ✅ PUBLIC feed list or single post (+ views)
    if (req.method === "GET" && q1(req.query?.public) === "feed") {
      const id = String(q1(req.query?.id) || "");
      const q = String(q1(req.query?.q) || "");
      const tag = String(q1(req.query?.tag) || "").toUpperCase();
      const category = String(q1(req.query?.category) || "");

      const uid = await optionalAuthUid(req);
      const deviceId = deviceIdFrom(req);

      const postsRaw = await prisma.feedPost.findMany({
        where: {
          ...(id ? { id } : {}),
          ...(q
            ? {
                OR: [
                  { title: { contains: q, mode: "insensitive" } },
                  { body: { contains: q, mode: "insensitive" } },
                  { category: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
          ...(tag ? { tags: { has: tag } } : {}),
          ...(category ? { category } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: id ? 1 : 50,
        include: {
          author: {
            select: { id: true, username: true, avatarUrl: true, lastActiveAt: true, isVerified: true, tier: true },
          },
          _count: { select: { likes: true, comments: true, views: true } },
          ...(uid ? { likes: { where: { userId: uid }, select: { id: true } } } : {}),
          ...(id
            ? {
                comments: {
                  orderBy: { createdAt: "desc" },
                  take: 50,
                  include: {
                    author: {
                      select: { id: true, username: true, avatarUrl: true, lastActiveAt: true, isVerified: true, tier: true },
                    },
                  },
                },
              }
            : {}),
        },
      });

      // record unique view only for details fetch
      const createdView = id ? await recordFeedViewSmart(id, uid, deviceId) : false;

      const posts = postsRaw.map((post) => {
        const { _count, likes, ...rest } = post;

        const baseViews = _count?.views ?? 0;
        const viewCount = id && post.id === id && createdView ? baseViews + 1 : baseViews;

        return {
          ...rest,
          likeCount: _count?.likes ?? 0,
          commentCount: _count?.comments ?? 0,
          viewCount,
          likedByMe: uid ? (likes?.length ?? 0) > 0 : false,
        };
      });

      return res.status(200).json({ posts });
    }

    // Everything else requires auth
    const decoded = await requireAuth(req);

    // AUTH feed unread
    if (req.method === "GET" && q1(req.query?.feedUnread) === "1") {
      const u = await prisma.user.findUnique({
        where: { id: decoded.uid },
        select: { lastFeedSeenAt: true },
      });

      const since = u?.lastFeedSeenAt ?? new Date(0);
      const unreadFeedCount = await prisma.feedPost.count({
        where: { createdAt: { gt: since } },
      });

      return res.status(200).json({ unreadFeedCount });
    }

    // AUTH dashboard payload
    if (req.method === "GET") {
      const user = await prisma.user.upsert({
        where: { id: decoded.uid },
        update: { email: decoded.email ?? "unknown" },
        create: { id: decoded.uid, email: decoded.email ?? "unknown" },
        include: {
          listings: { orderBy: { createdAt: "desc" } },
          purchases: { orderBy: { createdAt: "desc" }, include: { listing: true } },
          sales: { orderBy: { createdAt: "desc" }, include: { listing: true } },
          upgradeRequests: {
            where: { status: "PENDING" },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      const plans = await prisma.plan.findMany({
        where: { isActive: true },
        orderBy: [{ order: "asc" }, { name: "asc" }],
      });

      const currentPlan =
        plans.find((plan) => plan.name === user.tier) ||
        plans.find((plan) => plan.name === "FREE") ||
        null;

      const mk = monthKey();
      const usage = await prisma.usageMonth.upsert({
        where: { userId_monthKey: { userId: user.id, monthKey: mk } },
        update: {},
        create: { userId: user.id, monthKey: mk },
      });

      const pendingUpgradeRequest = user.upgradeRequests?.[0] ?? null;

      return res.status(200).json({ user, plans, currentPlan, usage, pendingUpgradeRequest });
    }

    // POST intents (keep your existing ones)
    if (req.method === "POST") {
      const body = readJson(req);

      // role lookup (admin delete)
      const dbUserRole = await prisma.user.findUnique({
        where: { id: decoded.uid },
        select: { role: true },
      });
      const isAdmin = dbUserRole?.role === "ADMIN";

      // ... keep ALL your existing intents here unchanged ...
      // (markFeedSeen, toggleFeedLike, add/edit/delete comments, presencePing, requestUpgrade, setAvatar, setUsername)

      // If you want, paste your POST block and I’ll merge it cleanly here.
      return res.status(400).json({ message: "Unknown action" });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ message: "Method not allowed" });
  } catch (e) {
    return res.status(e.statusCode ?? 500).json({ message: e.message ?? "Error" });
  }
}