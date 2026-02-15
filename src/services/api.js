// src/services/api.js
// -----------------------------------------------------------------------------
// Axios instance used by your whole app.
//
// Improvements (without breaking existing callers):
//  Always sends `x-device-id` (your backend uses it to dedupe anonymous views)
//  Automatically attaches Firebase Bearer token when logged in
//  Adds BEST-EFFORT idempotency keys for common double-submit actions:
//      - POST /api/listings intent=checkout
//      - POST /api/listings intent=addListingBid
//      - POST /api/listings intent=addListingComment
//    (only if caller didn’t already set an Idempotency-Key)
//  Safe in environments where localStorage/sessionStorage is blocked
// -----------------------------------------------------------------------------

import axios from "axios";
import { auth } from "../firebase";

export const api = axios.create({
  baseURL: "/api",
});

// -----------------------------------------------------------------------------
// Device id (for unique views / dedupe)
// Backend reads: req.headers["x-device-id"]
// -----------------------------------------------------------------------------
function getDeviceId() {
  const key = "microbid_device_id";
  if (typeof window === "undefined") return "";

  let id = null;
  try {
    id = window.localStorage.getItem(key);
  } catch {
    // storage blocked; fall back to ephemeral
  }

  if (!id) {
    id =
      (window.crypto?.randomUUID?.() ||
        `${Date.now()}_${Math.random().toString(16).slice(2)}`);

    try {
      window.localStorage.setItem(key, id);
    } catch {
      // ignore if storage blocked
    }
  }

  return id;
}

// -----------------------------------------------------------------------------
// Idempotency (client-side key generator with short TTL)
// Server supports:
//   req.headers["idempotency-key"] / "x-idempotency-key" / "Idempotency-Key"
// -----------------------------------------------------------------------------
function safeParseJsonMaybe(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function getRequestBody(config) {
  // axios may give config.data as object or string
  const d = config?.data;
  if (!d) return null;

  // Don’t touch FormData uploads
  if (typeof FormData !== "undefined" && d instanceof FormData) return null;

  if (typeof d === "string") return safeParseJsonMaybe(d) ?? null;
  if (typeof d === "object") return d;

  return null;
}

function sessionGet(key) {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function sessionSet(key, val) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, val);
  } catch {
    // ignore
  }
}

function getOrCreateIdempotencyKey(storageKey, ttlMs) {
  // stores: { key, exp }
  const raw = sessionGet(storageKey);
  if (raw) {
    const parsed = safeParseJsonMaybe(raw);
    if (parsed?.key && parsed?.exp && Date.now() < parsed.exp) return parsed.key;
  }

  const key =
    (typeof window !== "undefined" && window.crypto?.randomUUID?.()) ||
    `k_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  sessionSet(storageKey, JSON.stringify({ key, exp: Date.now() + ttlMs }));
  return key;
}

// small stable hash to avoid huge keys (NOT cryptographic; just for bucketing)
function tinyHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function maybeAttachIdempotencyKey(config) {
  const method = (config.method || "get").toLowerCase();
  const url = String(config.url || "");

  // Only for POST /listings
  if (method !== "post") return config;
  if (!url.includes("/listings")) return config;

  config.headers = config.headers ?? {};

  // If caller already set it, don’t override
  const existing =
    config.headers["Idempotency-Key"] ||
    config.headers["idempotency-key"] ||
    config.headers["x-idempotency-key"];
  if (existing) return config;

  const body = getRequestBody(config);
  const intent = body?.intent;

  // Only attach for the intents that are commonly double-submitted
  if (!intent) return config;

  if (intent === "checkout") {
    const listingId = String(body?.listingId || "");
    if (!listingId) return config;

    const key = getOrCreateIdempotencyKey(`idem:checkout:${listingId}`, 2 * 60 * 1000);
    config.headers["Idempotency-Key"] = key;
    return config;
  }

  if (intent === "addListingBid") {
    const listingId = String(body?.listingId || "");
    const amount = String(body?.amount ?? "");
    if (!listingId || !amount) return config;

    const key = getOrCreateIdempotencyKey(`idem:bid:${listingId}:${amount}`, 30 * 1000);
    config.headers["Idempotency-Key"] = key;
    return config;
  }

  if (intent === "addListingComment") {
    const listingId = String(body?.listingId || "");
    const commentBody = String(body?.body || "").trim();
    if (!listingId || !commentBody) return config;

    // Keep key stable for 60s for the same comment text
    const key = getOrCreateIdempotencyKey(
      `idem:comment:${listingId}:${tinyHash(commentBody.slice(0, 500))}`,
      60 * 1000
    );
    config.headers["Idempotency-Key"] = key;
    return config;
  }

  return config;
}

// -----------------------------------------------------------------------------
// Request interceptor
// -----------------------------------------------------------------------------
api.interceptors.request.use(async (config) => {
  config.headers = config.headers ?? {};

  // 1) device id header (lowercase name matches backend lookup)
  try {
    const did = getDeviceId();
    if (did) config.headers["x-device-id"] = did;
  } catch {
    // ignore
  }

  // 2) idempotency key (best-effort; only for certain POST /listings intents)
  config = maybeAttachIdempotencyKey(config);

  // 3) auth token if logged in
  try {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // if token fails, proceed as guest
  }

  return config;
});