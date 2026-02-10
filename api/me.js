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

export default async function handler(req, res) {
  try {
    // -------------------------
    // PUBLIC: username availability check
    // GET /api/me?checkUsername=...
    // -------------------------
    const check = req.query?.checkUsername;
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

      // If user is logged in, allow their current username
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
        for (const c of candidates) {
          if (await usernameAvailable(c, null)) filtered.push(c);
        }
        suggestions = filtered;
      }

      return res.status(200).json({ available, normalized, suggestions });
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

    // -------------------------
    // PUBLIC: plans list
    // GET /api/me?public=plans
    // -------------------------
    if (req.method === "GET" && req.query?.public === "plans") {
      const plans = await prisma.plan.findMany({
        where: { isActive: true },
        orderBy: [{ order: "asc" }, { name: "asc" }],
      });
      return res.status(200).json({ plans });
    }

    // -------------------------
    // PUBLIC: feed list OR single post
    // GET /api/me?public=feed
    // optional: &id=... &q=... &tag=... &category=...
    // -------------------------
 // -------------------------
// PUBLIC: feed list OR single post
// GET /api/me?public=feed
// optional: &id=... &q=... &tag=... &category=...
// -------------------------
if (req.method === "GET" && req.query?.public === "feed") {
  const id = String(req.query?.id || "");
  const q = String(req.query?.q || "");
  const tag = String(req.query?.tag || "").toUpperCase(); // NEW | UPDATE | CHANGELOG
  const category = String(req.query?.category || "");

  const uid = await optionalAuthUid(req); // may be null

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
      author: { select: { id: true, username: true, avatarUrl: true, isVerified: true, tier: true } },

      _count: { select: { likes: true, comments: true } },

      ...(uid
        ? { likes: { where: { userId: uid }, select: { id: true } } }
        : {}),

      ...(id
        ? {
            comments: {
              orderBy: { createdAt: "desc" },
              take: 50,
              include: {
                author: { select: { id: true, username: true, avatarUrl: true, isVerified: true, tier: true } },
              },
            },
          }
        : {}),
    },
  });

  const posts = postsRaw.map((p) => {
    const { _count, likes, ...rest } = p;
    return {
      ...rest,
      likeCount: _count?.likes ?? 0,
      commentCount: _count?.comments ?? 0,
      likedByMe: uid ? (likes?.length ?? 0) > 0 : false,
    };
  });

  return res.status(200).json({ posts });
}

    // -------------------------
    // Everything else requires auth
    // -------------------------
    const decoded = await requireAuth(req);

    // -------------------------
    // AUTH: feed unread count
    // GET /api/me?feedUnread=1
    // -------------------------
    if (req.method === "GET" && req.query?.feedUnread === "1") {
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

    // -------------------------
    // AUTH: main dashboard payload
    // GET /api/me
    // -------------------------
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
        plans.find((p) => p.name === user.tier) || plans.find((p) => p.name === "FREE") || null;

      const mk = monthKey();
      const usage = await prisma.usageMonth.upsert({
        where: { userId_monthKey: { userId: user.id, monthKey: mk } },
        update: {},
        create: { userId: user.id, monthKey: mk },
      });

      const pendingUpgradeRequest = user.upgradeRequests?.[0] ?? null;

      return res.status(200).json({ user, plans, currentPlan, usage, pendingUpgradeRequest });
    }

    // -------------------------
    // POST /api/me
    // - markFeedSeen
    // - requestUpgrade
    // - setUsername
    // -------------------------
    if (req.method === "POST") {
      const body = readJson(req);


      const dbUserRole = await prisma.user.findUnique({
            where: { id: decoded.uid },
            select: { role: true },
            });

      const isAdmin = dbUserRole?.role === "ADMIN";






if (body.intent === "editFeedComment") {
  const commentId = String(body.commentId || "");
  const text = String(body.body || "").trim();

  if (!commentId) return res.status(400).json({ message: "commentId is required" });
  if (!text) return res.status(400).json({ message: "Comment cannot be empty" });
  if (text.length > 2000) return res.status(400).json({ message: "Comment too long (max 2000 chars)" });

  const existing = await prisma.feedComment.findUnique({
    where: { id: commentId },
    select: { id: true, authorId: true, postId: true },
  });

  if (!existing) return res.status(404).json({ message: "Comment not found" });
  if (existing.authorId !== decoded.uid) return res.status(403).json({ message: "Not allowed" });

  const comment = await prisma.feedComment.update({
    where: { id: commentId },
    data: { body: text },
    include: {
      author: { select: { id: true, username: true, avatarUrl: true, isVerified: true, tier: true } },
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
    select: { _count: { select: { likes: true, comments: true } } },
  });

  return res.status(200).json({
    ok: true,
    commentId,
    postId: existing.postId,
    likeCount: counts?._count?.likes ?? 0,
    commentCount: counts?._count?.comments ?? 0,
  });
}

      if (body.intent === "toggleFeedLike") {
  const postId = String(body.postId || "");
  if (!postId) return res.status(400).json({ message: "postId is required" });

  const where = { postId_userId: { postId, userId: decoded.uid } };
  const existing = await prisma.feedPostLike.findUnique({ where });

  if (existing) {
    await prisma.feedPostLike.delete({ where });
  } else {
    await prisma.feedPostLike.create({ data: { postId, userId: decoded.uid } });
  }

  const counts = await prisma.feedPost.findUnique({
    where: { id: postId },
    select: { _count: { select: { likes: true, comments: true } } },
  });

  return res.status(200).json({
    liked: !existing,
    likeCount: counts?._count?.likes ?? 0,
    commentCount: counts?._count?.comments ?? 0,
  });
}



if (body.intent === "addFeedComment") {
  const postId = String(body.postId || "");
  const text = String(body.body || "").trim();

  if (!postId) return res.status(400).json({ message: "postId is required" });
  if (!text) return res.status(400).json({ message: "Comment cannot be empty" });
  if (text.length > 2000) return res.status(400).json({ message: "Comment too long (max 2000 chars)" });

  const comment = await prisma.feedComment.create({
    data: { postId, authorId: decoded.uid, body: text },
    include: {
      author: { select: { id: true, username: true, isVerified: true, tier: true } },
    },
  });

  const counts = await prisma.feedPost.findUnique({
    where: { id: postId },
    select: { _count: { select: { likes: true, comments: true } } },
  });

  return res.status(201).json({
    comment,
    likeCount: counts?._count?.likes ?? 0,
    commentCount: counts?._count?.comments ?? 0,
  });
}

      // mark feed seen
      if (body.intent === "markFeedSeen") {
        await prisma.user.update({
          where: { id: decoded.uid },
          data: { lastFeedSeenAt: new Date() },
        });
        return res.status(200).json({ ok: true });
      }

      // upgrade request
      if (body.intent === "requestUpgrade") {
        const planName = String(body.planName || "").toUpperCase();

        if (!["PRO", "VIP"].includes(planName)) {
          return res
            .status(400)
            .json({ message: "Invalid plan. Only PRO or VIP upgrades allowed." });
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

      // set username
      if (body.username || body.intent === "setUsername") {
        const normalized = normalizeUsername(body.username);

        if (!isValidUsername(normalized)) {
          return res.status(400).json({
            message: "Invalid username. Use 3-20 chars: a-z, 0-9, underscore.",
          });
        }

        const available = await usernameAvailable(normalized, decoded.uid);
        if (!available) {
          return res.status(409).json({ message: "Username is already taken." });
        }

        const updated = await prisma.user.upsert({
          where: { id: decoded.uid },
          update: { username: normalized, email: decoded.email ?? "unknown" },
          create: { id: decoded.uid, email: decoded.email ?? "unknown", username: normalized },
          select: {
            id: true,
            email: true,
            username: true,
            role: true,
            tier: true,
            isVerified: true,
          },
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