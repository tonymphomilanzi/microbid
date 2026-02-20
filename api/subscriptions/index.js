import { prisma } from "../_lib/prisma.js";
import { requireAuth } from "../_lib/auth.js";

function readJson(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === "object") return b;
  if (Buffer.isBuffer(b)) return JSON.parse(b.toString("utf8"));
  if (typeof b === "string") return JSON.parse(b);
  return {};
}

function qv(v) {
  return Array.isArray(v) ? v[0] : v;
}

function getQuery(req) {
  if (req?.query && typeof req.query === "object") return req.query;
  const url = new URL(req.url || "", "http://localhost");
  return Object.fromEntries(url.searchParams.entries());
}

// -----------------------------
// AppConfig cache
// -----------------------------
const APP_CONFIG_CACHE = { value: null, exp: 0 };

async function getAppConfigCached() {
  const now = Date.now();
  if (APP_CONFIG_CACHE.value && now < APP_CONFIG_CACHE.exp) return APP_CONFIG_CACHE.value;

  const cfg =
    (await prisma.appConfig.findUnique({ where: { id: "global" } }).catch(() => null)) ||
    (await prisma.appConfig.create({ data: { id: "global", escrowFeeBps: 200 } }).catch(() => null));

  APP_CONFIG_CACHE.value = cfg;
  APP_CONFIG_CACHE.exp = now + 30_000;
  return cfg;
}

function validateManualConfigForMethod(cfg, method) {
  const missing = [];
  const has = (v) => Boolean(v && String(v).trim());

  if (method === "BTC") {
    if (!has(cfg?.companyBtcAddress)) missing.push("Bitcoin address");
  }
  if (method === "MOMO") {
    if (!has(cfg?.companyMomoName)) missing.push("MoMo account name");
    if (!has(cfg?.companyMomoNumber)) missing.push("MoMo number");
  }
  if (method === "WU") {
    if (!has(cfg?.companyWuName)) missing.push("WU receiver name");
    if (!has(cfg?.companyWuCountry)) missing.push("WU receiver country");
  }
  if (method === "BANK") {
    if (!has(cfg?.companyBankName)) missing.push("Bank name");
    if (!has(cfg?.companyBankAccountName)) missing.push("Bank account name");
    if (!has(cfg?.companyBankAccountNumber)) missing.push("Bank account number");
  }

  return missing;
}

function instructionsFromConfig(cfg, method, paymentId, totalChargeCents) {
  const totalUsd = (Number(totalChargeCents || 0) / 100).toFixed(2);

  const safe = (v) => (v && String(v).trim() ? String(v).trim() : "Not set");
  const opt = (v) => (v && String(v).trim() ? String(v).trim() : null);

  if (method === "BTC") {
    return {
      qrUrl: opt(cfg?.companyBtcQrUrl) || null,
      lines: [
        `Send exactly $${totalUsd} worth of BTC to the address below.`,
        `Reference code: ${paymentId}. Keep it for proof.`,
      ],
      fields: [
        { label: "BTC Address", value: safe(cfg?.companyBtcAddress) },
        { label: "Network", value: safe(cfg?.companyBtcNetwork || "Bitcoin") },
      ],
    };
  }

  if (method === "MOMO") {
    return {
      qrUrl: null,
      lines: [
        `Send exactly $${totalUsd} (or equivalent) to the Mobile Money details below.`,
        `Use reference code: ${paymentId} as the payment reference.`,
      ],
      fields: [
        { label: "Account Name", value: safe(cfg?.companyMomoName) },
        { label: "MoMo Number", value: safe(cfg?.companyMomoNumber) },
        { label: "Country", value: safe(cfg?.companyMomoCountry) },
      ],
    };
  }

  if (method === "WU") {
    return {
      qrUrl: null,
      lines: [
        `Send exactly $${totalUsd} via Western Union.`,
        `Use reference code: ${paymentId} (if possible).`,
      ],
      fields: [
        { label: "Receiver Name", value: safe(cfg?.companyWuName) },
        { label: "Receiver Country", value: safe(cfg?.companyWuCountry) },
        { label: "Receiver City", value: safe(cfg?.companyWuCity) },
      ],
    };
  }

  // BANK
  return {
    qrUrl: null,
    lines: [
      `Send exactly $${totalUsd} via bank transfer.`,
      `Put reference code: ${paymentId} in the transfer memo/reference.`,
    ],
    fields: [
      { label: "Bank Name", value: safe(cfg?.companyBankName) },
      { label: "Account Name", value: safe(cfg?.companyBankAccountName) },
      { label: "Account Number", value: safe(cfg?.companyBankAccountNumber) },
      { label: "SWIFT / IBAN", value: safe(cfg?.companyBankSwift) },
      { label: "Country", value: safe(cfg?.companyBankCountry) },
    ],
  };
}

// Advisory lock
async function advisoryLock(tx, lockKey) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
}

export default async function handler(req, res) {
  try {
    const query = getQuery(req);

    // ---------- GET ----------
    // GET /api/subscriptions?paymentId=xxx => get payment details
    if (req.method === "GET") {
      const paymentId = qv(query?.paymentId);

      if (paymentId) {
        const decoded = await requireAuth(req);

        const payment = await prisma.subscriptionPayment.findUnique({
          where: { id: paymentId },
          include: {
            plan: true,
          },
        });

        if (!payment) {
          return res.status(404).json({ message: "Payment not found" });
        }

        if (payment.userId !== decoded.uid) {
          return res.status(403).json({ message: "Not allowed" });
        }

        const cfg = await getAppConfigCached();
        const method = payment.provider === "MANUAL" ? payment.providerRef : payment.provider;
        const instructions = instructionsFromConfig(cfg, method, payment.id, payment.totalChargeCents);

        return res.status(200).json({ payment, instructions });
      }

      // List user's subscription payments
      const decoded = await requireAuth(req);

      const payments = await prisma.subscriptionPayment.findMany({
        where: { userId: decoded.uid },
        include: { plan: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      return res.status(200).json({ payments });
    }

    // ---------- POST ----------
    if (req.method === "POST") {
      const decoded = await requireAuth(req);
      const body = readJson(req);
      const intent = body.intent || "startPayment";

      // ---------- Start subscription payment ----------
      if (intent === "startPayment") {
        const planName = String(body.planName || "").toUpperCase();
        const method = String(body.method || "").toUpperCase();

        if (!planName) {
          return res.status(400).json({ message: "Missing planName" });
        }
        if (!method) {
          return res.status(400).json({ message: "Missing method" });
        }

        const plan = await prisma.plan.findUnique({ where: { name: planName } });
        if (!plan || !plan.isActive) {
          return res.status(400).json({ message: "Plan not available" });
        }

        // Check if user already has this plan
        const user = await prisma.user.findUnique({
          where: { id: decoded.uid },
          select: { id: true, tier: true, role: true },
        });

        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        if (user.role === "ADMIN") {
          return res.status(400).json({ message: "Admin already has unlimited access." });
        }

        if (user.tier === planName) {
          return res.status(400).json({ message: "You are already on this plan." });
        }

        // Check for pending payment for same plan
        const existingPending = await prisma.subscriptionPayment.findFirst({
          where: {
            userId: decoded.uid,
            planId: plan.id,
            status: { in: ["INITIATED", "SUBMITTED"] },
          },
          orderBy: { createdAt: "desc" },
        });

        if (existingPending) {
          // Return existing payment
          const cfg = await getAppConfigCached();
          const existingMethod = existingPending.provider === "MANUAL" ? existingPending.providerRef : existingPending.provider;
          const instructions = instructionsFromConfig(cfg, existingMethod, existingPending.id, existingPending.totalChargeCents);

          return res.status(200).json({
            payment: existingPending,
            plan,
            instructions,
            existing: true,
          });
        }

        // Map method to provider
        const map = {
          BTC: { provider: "BTC", providerRef: null },
          MOMO: { provider: "MOMO", providerRef: null },
          WU: { provider: "MANUAL", providerRef: "WU" },
          BANK: { provider: "MANUAL", providerRef: "BANK" },
        };

        const mapped = map[method];
        if (!mapped) {
          return res.status(400).json({ message: "Unsupported payment method" });
        }

        const cfg = await getAppConfigCached();
        const missing = validateManualConfigForMethod(cfg, method);
        if (missing.length) {
          return res.status(400).json({
            message: `Payment method not configured: missing ${missing.join(", ")}. Contact admin.`,
          });
        }

        // Calculate price
        const priceCents =
          plan.billingType === "MONTHLY"
            ? plan.monthlyPriceCents
            : plan.billingType === "LIFETIME"
              ? plan.oneTimePriceCents
              : 0;

        if (priceCents <= 0) {
          return res.status(400).json({ message: "This plan is free or has no price set." });
        }

        const feeCents = 0; // No fee for subscriptions (optional: add fee)
        const totalChargeCents = priceCents + feeCents;

        const payment = await prisma.$transaction(async (tx) => {
          await advisoryLock(tx, `sub:payment:${decoded.uid}:${plan.id}`);

          // Double check for race
          const racing = await tx.subscriptionPayment.findFirst({
            where: {
              userId: decoded.uid,
              planId: plan.id,
              status: { in: ["INITIATED", "SUBMITTED"] },
            },
          });

          if (racing) return racing;

          return tx.subscriptionPayment.create({
            data: {
              userId: decoded.uid,
              planId: plan.id,
              provider: mapped.provider,
              providerRef: mapped.providerRef,
              status: "INITIATED",
              priceCents,
              feeCents,
              totalChargeCents,
            },
          });
        });

        const instructions = instructionsFromConfig(cfg, method, payment.id, payment.totalChargeCents);

        return res.status(200).json({ payment, plan, instructions });
      }

      // ---------- Submit payment confirmation ----------
      if (intent === "submitPayment") {
        const paymentId = String(body.paymentId || "");
        const reference = String(body.reference || "").trim();
        const proofUrl = body.proofUrl ? String(body.proofUrl).trim() : null;
        const note = body.note ? String(body.note).trim() : null;

        if (!paymentId) {
          return res.status(400).json({ message: "Missing paymentId" });
        }
        if (!reference) {
          return res.status(400).json({ message: "Payment reference is required" });
        }

        const result = await prisma.$transaction(async (tx) => {
          await advisoryLock(tx, `sub:submit:${paymentId}`);

          const payment = await tx.subscriptionPayment.findUnique({
            where: { id: paymentId },
            include: { plan: true },
          });

          if (!payment) {
            const err = new Error("Payment not found");
            err.statusCode = 404;
            throw err;
          }

          if (payment.userId !== decoded.uid) {
            const err = new Error("Not allowed");
            err.statusCode = 403;
            throw err;
          }

          if (payment.status === "VERIFIED") {
            return { payment, alreadyVerified: true };
          }

          if (payment.status === "SUBMITTED") {
            return { payment, alreadySubmitted: true };
          }

          if (payment.status !== "INITIATED") {
            const err = new Error(`Cannot submit payment in status ${payment.status}`);
            err.statusCode = 400;
            throw err;
          }

          const updated = await tx.subscriptionPayment.update({
            where: { id: paymentId },
            data: {
              status: "SUBMITTED",
              reference,
              proofUrl,
              note,
            },
            include: { plan: true },
          });

          // Notify user (optional)
          const canNotify = Boolean(tx.notification);
          if (canNotify) {
            await tx.notification.create({
              data: {
                userId: decoded.uid,
                type: "SUBSCRIPTION_PAYMENT_SUBMITTED",
                title: "Payment submitted",
                body: `Your payment for ${payment.plan?.name} plan is being verified.`,
                url: "/dashboard",
                meta: { paymentId: payment.id, planId: payment.planId },
              },
            });
          }

          return { payment: updated };
        });

        return res.status(200).json(result);
      }

      return res.status(400).json({ message: "Unknown intent" });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ message: "Method not allowed" });
  } catch (e) {
    return res.status(e.statusCode ?? 500).json({ message: e.message ?? "Error" });
  }
}