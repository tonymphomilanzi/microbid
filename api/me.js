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

export default async function handler(req, res) {
  try {
    // ✅ PUBLIC username availability check (no auth required)
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

      // Optional: if user is logged in, allow their current username
      let currentUid = null;
      try {
        const header = req.headers.authorization || "";
        if (header.startsWith("Bearer ")) {
          const decoded = await requireAuth(req); // will succeed only if token valid
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

    // ✅ Everything else requires auth
    const decoded = await requireAuth(req);

    if (req.method === "GET") {
      const user = await prisma.user.upsert({
        where: { id: decoded.uid },
        update: { email: decoded.email ?? "unknown" },
        create: { id: decoded.uid, email: decoded.email ?? "unknown" },
        include: {
          listings: { orderBy: { createdAt: "desc" } },
          purchases: {
            orderBy: { createdAt: "desc" },
            include: { listing: true },
          },
          sales: {
            orderBy: { createdAt: "desc" },
            include: { listing: true },
          },
        },
      });

      return res.status(200).json({ user });
    }

    // Set/update username
    if (req.method === "POST") {
      const body = readJson(req);
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
        create: {
          id: decoded.uid,
          email: decoded.email ?? "unknown",
          username: normalized,
        },
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

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ message: "Method not allowed" });
  } catch (e) {
    return res.status(e.statusCode ?? 500).json({ message: e.message ?? "Error" });
  }
}