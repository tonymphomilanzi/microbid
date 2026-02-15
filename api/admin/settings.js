import { prisma } from "../_lib/prisma.js";
import { requireAuth } from "../_lib/auth.js";

// -----------------------------
// helpers
// -----------------------------
function send(res, status, json) {
  return res.status(status).json(json);
}

function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) return xff.split(",")[0].trim();
  return req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown";
}

// tiny in-memory rate limit (per warm lambda)
const RL = new Map(); // key -> {count, resetAt}
function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const cur = RL.get(key);
  if (!cur || now > cur.resetAt) {
    RL.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (cur.count >= limit) return false;
  cur.count += 1;
  return true;
}

function readJson(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === "object") return b;
  if (Buffer.isBuffer(b)) return JSON.parse(b.toString("utf8"));
  if (typeof b === "string") return JSON.parse(b);
  return {};
}

function strOrNull(v) {
  if (v === undefined) return undefined; // means "don't change"
  if (v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function intOrUndefined(v) {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.trunc(n);
}

async function requireAdmin(req) {
  const decoded = await requireAuth(req);
  const u = await prisma.user.findUnique({
    where: { id: decoded.uid },
    select: { id: true, role: true },
  });
  if (!u || u.role !== "ADMIN") {
    const err = new Error("Admin only");
    err.statusCode = 403;
    throw err;
  }
  return decoded;
}

async function getOrCreateGlobalConfig() {
  const existing = await prisma.appConfig.findUnique({ where: { id: "global" } });
  if (existing) return existing;

  return prisma.appConfig.create({
    data: { id: "global", escrowFeeBps: 200 },
  });
}

// -----------------------------
// handler
// -----------------------------
export default async function handler(req, res) {
  try {
    // basic RL
    const ip = getClientIp(req);
    if (!rateLimit(`adminSettings:${ip}`, 60, 60_000)) {
      res.setHeader("Retry-After", "60");
      return send(res, 429, { message: "Too many requests. Please slow down." });
    }

    await requireAdmin(req);

    if (req.method === "GET") {
      const settings = await getOrCreateGlobalConfig();
      return send(res, 200, { settings });
    }

    if (req.method === "POST") {
      const body = readJson(req);

      // allow either {settings:{...}} or direct fields
      const s = body.settings && typeof body.settings === "object" ? body.settings : body;

      const escrowFeeBps = intOrUndefined(s.escrowFeeBps);
      if (escrowFeeBps !== undefined && (escrowFeeBps < 0 || escrowFeeBps > 2000)) {
        return send(res, 400, { message: "escrowFeeBps must be between 0 and 2000" });
      }

      const updated = await prisma.appConfig.upsert({
        where: { id: "global" },
        create: {
          id: "global",
          escrowAgentUid: strOrNull(s.escrowAgentUid) ?? null,
          escrowFeeBps: escrowFeeBps ?? 200,

          companyBtcAddress: strOrNull(s.companyBtcAddress) ?? null,
          companyBtcNetwork: strOrNull(s.companyBtcNetwork) ?? null,

          companyMomoName: strOrNull(s.companyMomoName) ?? null,
          companyMomoNumber: strOrNull(s.companyMomoNumber) ?? null,
          companyMomoCountry: strOrNull(s.companyMomoCountry) ?? null,

          companyWuName: strOrNull(s.companyWuName) ?? null,
          companyWuCountry: strOrNull(s.companyWuCountry) ?? null,
          companyWuCity: strOrNull(s.companyWuCity) ?? null,

          companyBankName: strOrNull(s.companyBankName) ?? null,
          companyBankAccountName: strOrNull(s.companyBankAccountName) ?? null,
          companyBankAccountNumber: strOrNull(s.companyBankAccountNumber) ?? null,
          companyBankSwift: strOrNull(s.companyBankSwift) ?? null,
          companyBankCountry: strOrNull(s.companyBankCountry) ?? null,
        },
        update: {
          escrowAgentUid: strOrNull(s.escrowAgentUid),
          escrowFeeBps,

          companyBtcAddress: strOrNull(s.companyBtcAddress),
          companyBtcNetwork: strOrNull(s.companyBtcNetwork),

          companyMomoName: strOrNull(s.companyMomoName),
          companyMomoNumber: strOrNull(s.companyMomoNumber),
          companyMomoCountry: strOrNull(s.companyMomoCountry),

          companyWuName: strOrNull(s.companyWuName),
          companyWuCountry: strOrNull(s.companyWuCountry),
          companyWuCity: strOrNull(s.companyWuCity),

          companyBankName: strOrNull(s.companyBankName),
          companyBankAccountName: strOrNull(s.companyBankAccountName),
          companyBankAccountNumber: strOrNull(s.companyBankAccountNumber),
          companyBankSwift: strOrNull(s.companyBankSwift),
          companyBankCountry: strOrNull(s.companyBankCountry),
        },
      });

      return send(res, 200, { settings: updated });
    }

    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { message: "Method not allowed" });
  } catch (e) {
    return send(res, e.statusCode ?? 500, { message: e.message ?? "Error" });
  }
}