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

// ✅ Smart merge: device view -> user view (prevents double count on refresh)
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

// -----------------------------
// Notifications helpers
// -----------------------------
function requireNotificationModel() {
  if (!prisma.notification) {
    const err = new Error(
      "Prisma Client missing Notification model. Add Notification to schema.prisma, run `npx prisma generate`, redeploy."
    );
    err.statusCode = 500;
    throw err;
  }
  return prisma.notification;
}

// -----------------------------
// Plans helpers (NEW)
// -----------------------------
function normalizeFeatures(features) {
  const f = features && typeof features === "object" ? features : {};
  const listingsPerMonth = Number(f.listingsPerMonth ?? 0);
  const conversationsPerMonth = Number(f.conversationsPerMonth ?? 0);

  return {
    listingsPerMonth: Number.isFinite(listingsPerMonth) ? Math.trunc(listingsPerMonth) : 0,
    conversationsPerMonth: Number.isFinite(conversationsPerMonth) ? Math.trunc(conversationsPerMonth) : 0,
  };
}

function adminVirtualPlan() {
  return {
    id: "ADMIN",
    name: "ADMIN",
    billingType: "FREE",
    monthlyPriceCents: 0,
    oneTimePriceCents: 0,
    features: { listingsPerMonth: -1, conversationsPerMonth: -1 }, // unlimited
    tagline: "Unlimited",
    highlight: true,
    order: -1,
    isActive: true,
    createdAt: new Date(),
  };
}

function withNormalizedFeatures(plan) {
  if (!plan) return null;
  return { ...plan, features: normalizeFeatures(plan.features) };
}

export default async function handler(req, res) {
  try {
    // PUBLIC: username availability check
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

    // PUBLIC: plans list
    if (req.method === "GET" && q1(req.query?.public) === "plans") {
      const plansRaw = await prisma.plan.findMany({
        where: { isActive: true },
        orderBy: [{ order: "asc" }, { name: "asc" }],
      });

      const plans = plansRaw.map((p) => withNormalizedFeatures(p));
      return res.status(200).json({ plans });
    }

    // PUBLIC: feed list OR single post (+ unique views)
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
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              lastActiveAt: true,
              isVerified: true,
              tier: true,
            },
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
                      select: {
                        id: true,
                        username: true,
                        avatarUrl: true,
                        lastActiveAt: true,
                        isVerified: true,
                        tier: true,
                      },
                    },
                  },
                },
              }
            : {}),
        },
      });

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
    const Notification = requireNotificationModel();

    // -----------------------------
    // AUTH: Notifications list
    // GET /api/me?public=notifications&cursor=...
    // -----------------------------
    if (req.method === "GET" && q1(req.query?.public) === "notifications") {
      const cursorRaw = String(q1(req.query?.cursor) || "").trim();
      const cursorDate = cursorRaw ? new Date(cursorRaw) : null;

      const where = {
        userId: decoded.uid,
        ...(cursorDate && !Number.isNaN(cursorDate.getTime())
          ? { createdAt: { lt: cursorDate } }
          : {}),
      };

      const notifications = await Notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 30,
      });

      const unreadCount = await Notification.count({
        where: { userId: decoded.uid, isRead: false },
      });

      const nextCursor =
        notifications.length > 0 ? notifications[notifications.length - 1].createdAt.toISOString() : null;

      return res.status(200).json({ notifications, unreadCount, nextCursor });
    }

    // AUTH: feed unread count
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

    // AUTH: main dashboard payload (+ unreadNotificationsCount)
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

          // NEW: include subscription->plan so we can resolve limits correctly
          subscription: {
            include: { plan: true },
          },
        },
      });

      const plansRaw = await prisma.plan.findMany({
        where: { isActive: true },
        orderBy: [{ order: "asc" }, { name: "asc" }],
      });

      const plans = plansRaw.map((p) => withNormalizedFeatures(p));

      // NEW: resolve currentPlan (ADMIN unlimited -> subscription plan -> tier plan -> FREE)
      let currentPlan = null;

      if (user.role === "ADMIN") {
        currentPlan = adminVirtualPlan();
      } else if (user.subscription?.plan && user.subscription.status === "ACTIVE") {
        currentPlan = withNormalizedFeatures(user.subscription.plan);
      } else {
        const tierName = String(user.tier || "FREE").toUpperCase();
        currentPlan =
          plans.find((p) => p.name === tierName) ||
          plans.find((p) => p.name === "FREE") ||
          null;
      }

      const mk = monthKey();
      const usage = await prisma.usageMonth.upsert({
        where: { userId_monthKey: { userId: user.id, monthKey: mk } },
        update: {},
        create: { userId: user.id, monthKey: mk },
      });

      const pendingUpgradeRequest = user.upgradeRequests?.[0] ?? null;

      const unreadNotificationsCount = await Notification.count({
        where: { userId: decoded.uid, isRead: false },
      });

      return res.status(200).json({
        user,
        plans,
        currentPlan,
        usage,
        pendingUpgradeRequest,
        unreadNotificationsCount,
      });
    }

    // AUTH: POST intents
    if (req.method === "POST") {
      const body = readJson(req);

      const dbUserRole = await prisma.user.findUnique({
        where: { id: decoded.uid },
        select: { role: true },
      });
      const isAdmin = dbUserRole?.role === "ADMIN";

      // -----------------------------
      // Notifications: mark read
      // -----------------------------
      if (body.intent === "markNotificationsRead") {
        const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
        if (!ids.length) return res.status(200).json({ ok: true });

        await Notification.updateMany({
          where: { userId: decoded.uid, id: { in: ids } },
          data: { isRead: true },
        });

        const unreadCount = await Notification.count({
          where: { userId: decoded.uid, isRead: false },
        });

        return res.status(200).json({ ok: true, unreadCount });
      }

      if (body.intent === "markAllNotificationsRead") {
        await Notification.updateMany({
          where: { userId: decoded.uid, isRead: false },
          data: { isRead: true },
        });

        return res.status(200).json({ ok: true, unreadCount: 0 });
      }

      // existing intents...
      if (body.intent === "markFeedSeen") {
        await prisma.user.update({
          where: { id: decoded.uid },
          data: { lastFeedSeenAt: new Date() },
        });
        return res.status(200).json({ ok: true });
      }

      if (body.intent === "toggleFeedLike") {
        const postId = String(body.postId || "");
        if (!postId) return res.status(400).json({ message: "postId is required" });

        const where = { postId_userId: { postId, userId: decoded.uid } };
        const existing = await prisma.feedPostLike.findUnique({ where });

        if (existing) await prisma.feedPostLike.delete({ where });
        else await prisma.feedPostLike.create({ data: { postId, userId: decoded.uid } });

        const counts = await prisma.feedPost.findUnique({
          where: { id: postId },
          select: { _count: { select: { likes: true, comments: true, views: true } } },
        });

        return res.status(200).json({
          liked: !existing,
          likeCount: counts?._count?.likes ?? 0,
          commentCount: counts?._count?.comments ?? 0,
          viewCount: counts?._count?.views ?? 0,
        });
      }

      if (body.intent === "addFeedComment") {
        const postId = String(body.postId || "");
        const text = String(body.body || "").trim();

        if (!postId) return res.status(400).json({ message: "postId is required" });
        if (!text) return res.status(400).json({ message: "Comment cannot be empty" });

        const comment = await prisma.feedComment.create({
          data: { postId, authorId: decoded.uid, body: text },
          include: {
            author: {
              select: { id: true, username: true, avatarUrl: true, lastActiveAt: true, isVerified: true, tier: true },
            },
          },
        });

        const counts = await prisma.feedPost.findUnique({
          where: { id: postId },
          select: { _count: { select: { likes: true, comments: true, views: true } } },
        });

        return res.status(201).json({
          comment,
          likeCount: counts?._count?.likes ?? 0,
          commentCount: counts?._count?.comments ?? 0,
          viewCount: counts?._count?.views ?? 0,
        });
      }

      if (body.intent === "editFeedComment") {
        const commentId = String(body.commentId || "");
        const text = String(body.body || "").trim();

        if (!commentId) return res.status(400).json({ message: "commentId is required" });
        if (!text) return res.status(400).json({ message: "Comment cannot be empty" });

        const existing = await prisma.feedComment.findUnique({
          where: { id: commentId },
          select: { id: true, authorId: true },
        });

        if (!existing) return res.status(404).json({ message: "Comment not found" });
        if (existing.authorId !== decoded.uid) return res.status(403).json({ message: "Not allowed" });

        const comment = await prisma.feedComment.update({
          where: { id: commentId },
          data: { body: text },
          include: {
            author: {
              select: { id: true, username: true, avatarUrl: true, lastActiveAt: true, isVerified: true, tier: true },
            },
          },
        });

        return res.status(200).json({ comment });
      }

      if (body.intent === "deleteFeedComment") {
        const commentId = String(body.commentId || "");
        if (!commentId) return res.status(400).json({ message: "commentId is required" });

        const existing = await prisma.feedComment.findUnique({
          where: { id: commentId },
          select: { id: true, authorId: true, postId: true },
        });

        if (!existing) return res.status(404).json({ message: "Comment not found" });

        const canDelete = existing.authorId === decoded.uid || isAdmin;
        if (!canDelete) return res.status(403).json({ message: "Not allowed" });

        await prisma.feedComment.delete({ where: { id: commentId } });

        const counts = await prisma.feedPost.findUnique({
          where: { id: existing.postId },
          select: { _count: { select: { likes: true, comments: true, views: true } } },
        });

        return res.status(200).json({
          ok: true,
          commentId,
          postId: existing.postId,
          likeCount: counts?._count?.likes ?? 0,
          commentCount: counts?._count?.comments ?? 0,
          viewCount: counts?._count?.views ?? 0,
        });
      }

      if (body.intent === "presencePing") {
        await prisma.user.upsert({
          where: { id: decoded.uid },
          update: { email: decoded.email ?? "unknown", lastActiveAt: new Date() },
          create: { id: decoded.uid, email: decoded.email ?? "unknown", lastActiveAt: new Date() },
          select: { id: true },
        });
        return res.status(200).json({ ok: true });
      }

      if (body.intent === "requestUpgrade") {
        const planName = String(body.planName || "").toUpperCase();
        if (!["PRO", "VIP"].includes(planName)) {
          return res.status(400).json({ message: "Invalid plan. Only PRO or VIP upgrades allowed." });
        }

        const plan = await prisma.plan.findUnique({ where: { name: planName } });
        if (!plan || !plan.isActive) return res.status(400).json({ message: "Plan not available." });

        const dbUser = await prisma.user.upsert({
          where: { id: decoded.uid },
          update: { email: decoded.email ?? "unknown" },
          create: { id: decoded.uid, email: decoded.email ?? "unknown" },
          select: { id: true, tier: true },
        });

        if (dbUser.tier === planName) {
          return res.status(400).json({ message: "You are already on this plan." });
        }

        const existingPending = await prisma.upgradeRequest.findFirst({
          where: { userId: dbUser.id, status: "PENDING" },
          orderBy: { createdAt: "desc" },
        });

        if (existingPending) {
          return res.status(409).json({ message: "You already have a pending upgrade request." });
        }

        const created = await prisma.upgradeRequest.create({
          data: { userId: dbUser.id, requestedPlan: planName, status: "PENDING" },
        });

        return res.status(201).json({ request: created });
      }

      if (body.intent === "setAvatar") {
        const url = String(body.avatarUrl || "").trim();
        const avatarUrl = url ? url : null;

        const updated = await prisma.user.upsert({
          where: { id: decoded.uid },
          update: { email: decoded.email ?? "unknown", avatarUrl },
          create: { id: decoded.uid, email: decoded.email ?? "unknown", avatarUrl },
          select: { id: true, email: true, username: true, avatarUrl: true, role: true, tier: true, isVerified: true },
        });

        return res.status(200).json({ user: updated });
      }

      if (body.username || body.intent === "setUsername") {
        const normalized = normalizeUsername(body.username);

        if (!isValidUsername(normalized)) {
          return res.status(400).json({
            message: "Invalid username. Use 3-20 chars: a-z, 0-9, underscore.",
          });
        }

        const available = await usernameAvailable(normalized, decoded.uid);
        if (!available) return res.status(409).json({ message: "Username is already taken." });

        const updated = await prisma.user.upsert({
          where: { id: decoded.uid },
          update: { username: normalized, email: decoded.email ?? "unknown" },
          create: { id: decoded.uid, email: decoded.email ?? "unknown", username: normalized },
          select: { id: true, email: true, username: true, avatarUrl: true, role: true, tier: true, isVerified: true },
        });

        return res.status(200).json({ user: updated });
      }

      return res.status(400).json({ message: "Unknown action" });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ message: "Method not allowed" });
  } catch (e) {
    return res.status(e.statusCode ?? 500).json({ message: e.message ?? "Error" });
  }
}