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
    // PUBLIC: username availability check (no auth)
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

    // PUBLIC: plans list for Pricing page (no auth)
    if (req.method === "GET" && req.query?.public === "plans") {
      const plans = await prisma.plan.findMany({
        where: { isActive: true },
        orderBy: [{ order: "asc" }, { name: "asc" }],
      });
      return res.status(200).json({ plans });
    }

    // Everything else requires auth
    const decoded = await requireAuth(req);

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

    // POST: set username OR request upgrade
    if (req.method === "POST") {
      const body = readJson(req);

      // Upgrade request
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

        // prevent duplicate pending request
        const existingPending = await prisma.upgradeRequest.findFirst({
          where: { userId: dbUser.id, status: "PENDING" },
          orderBy: { createdAt: "desc" },
        });

        if (existingPending) {
          return res.status(409).json({ message: "You already have a pending upgrade request." });
        }

        const created = await prisma.upgradeRequest.create({
          data: {
            userId: dbUser.id,
            requestedPlan: planName,
            status: "PENDING",
          },
        });

        return res.status(201).json({ request: created });
      }

      // Set/update username (backward compatible: accepts {username} or {intent:"setUsername", username})
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
          select: { id: true, email: true, username: true, role: true, tier: true, isVerified: true },
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