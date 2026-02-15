// src/services/listings.service.js
// -----------------------------------------------------------------------------
// Same public API (same exported functions + same signatures) BUT improved:
//   ✅ Sends x-device-id on requests so anonymous views count + dedupe works
//   ✅ Adds Idempotency-Key headers for actions that are commonly double-submitted
//      (checkout, bids, comments) to reduce duplicates when user double-clicks/retries.
//   ✅ Keeps return shapes exactly the same (your UI code won’t break).
// -----------------------------------------------------------------------------

import { api } from "./api";

// -----------------------------
// Device id (for view tracking/deduping)
// Backend expects: header "x-device-id"
// -----------------------------
const DEVICE_ID_KEY = "device_id_v1";

function getOrCreateDeviceId() {
  if (typeof window === "undefined") return ""; // safety (shouldn't happen in SPA)
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;

    const next =
      (window.crypto?.randomUUID && window.crypto.randomUUID()) ||
      `d_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    window.localStorage.setItem(DEVICE_ID_KEY, next);
    return next;
  } catch {
    // If storage blocked, still generate something per session
    return `d_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

function withDeviceHeader(config = {}) {
  const did = getOrCreateDeviceId();
  return {
    ...config,
    headers: {
      ...(config.headers || {}),
      "x-device-id": did,
    },
  };
}

// -----------------------------
// Best-effort idempotency keys (client-side)
// Sent as header "Idempotency-Key".
// Notes:
//  - Your server now supports this header in the improved /api/listings/index.js
//  - We keep keys stable for a short time window to cover double-clicks/retries.
// -----------------------------
function makeKey(parts) {
  return parts.filter(Boolean).join(":").slice(0, 200);
}

function now() {
  return Date.now();
}

function getOrCreateIdempotencyKey(storageKey, ttlMs) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.key && parsed?.exp && now() < parsed.exp) return parsed.key;
    }
    const key =
      (window.crypto?.randomUUID && window.crypto.randomUUID()) ||
      `k_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    window.sessionStorage.setItem(storageKey, JSON.stringify({ key, exp: now() + ttlMs }));
    return key;
  } catch {
    return null;
  }
}

function withIdempotencyHeader(config = {}, idemKey) {
  if (!idemKey) return config;
  return {
    ...config,
    headers: {
      ...(config.headers || {}),
      "Idempotency-Key": idemKey,
    },
  };
}

export const listingsService = {
  // ---------------------------------------------------------------------------
  // Public
  // ---------------------------------------------------------------------------
  getListings: (params) =>
    api.get("/listings", withDeviceHeader({ params })).then((r) => r.data),

  // IMPORTANT: device header here makes your anonymous view tracking work
  // (your backend [id].js only records anonymous views when x-device-id exists)
  getListing: (id) =>
    api.get(`/listings/${id}`, withDeviceHeader()).then((r) => r.data),

  // ---------------------------------------------------------------------------
  // Auth required
  // ---------------------------------------------------------------------------
  upsertListing: (payload) =>
    api.post("/listings", payload, withDeviceHeader()).then((r) => r.data),

  deleteListing: (id) =>
    api.delete(`/listings/${id}`, withDeviceHeader()).then((r) => r.data),

  // Cloudinary upload endpoint (Auth required)
  // IMPORTANT: do NOT set Content-Type manually; axios will set correct boundary.
  uploadImage: (formData) =>
    api.post("/upload", formData, withDeviceHeader()).then((r) => r.data),

  me: () =>
    api.get("/me", withDeviceHeader()).then((r) => r.data),

  // ---------------------------------------------------------------------------
  // Stripe checkout (Auth required)
  // Adds idempotency key so double clicks don’t create multiple sessions/purchases.
  // ---------------------------------------------------------------------------
  checkout: (listingId) => {
    const idem = getOrCreateIdempotencyKey(makeKey(["idem", "checkout", listingId]), 2 * 60 * 1000);
    const cfg = withIdempotencyHeader(withDeviceHeader(), idem);
    return api.post("/listings", { intent: "checkout", listingId }, cfg).then((r) => r.data);
  },

  // ---------------------------------------------------------------------------
  // Meta
  // ---------------------------------------------------------------------------
  getPlatforms: () => api.get("/platforms", withDeviceHeader()).then((r) => r.data),
  getCategories: () => api.get("/categories", withDeviceHeader()).then((r) => r.data),

  // ---------------------------------------------------------------------------
  // Profile utils
  // ---------------------------------------------------------------------------
  checkUsername: (username) =>
    api.get("/me", withDeviceHeader({ params: { checkUsername: username } })).then((r) => r.data),

  setUsername: (username) =>
    api.post("/me", { username }, withDeviceHeader()).then((r) => r.data),

  getPlansPublic: () =>
    api.get("/me", withDeviceHeader({ params: { public: "plans" } })).then((r) => r.data),

  requestUpgrade: (planName) =>
    api.post("/me", { intent: "requestUpgrade", planName }, withDeviceHeader()).then((r) => r.data),

  setAvatar: (avatarUrl) =>
    api.post("/me", { intent: "setAvatar", avatarUrl }, withDeviceHeader()).then((r) => r.data),

  presencePing: () =>
    api.post("/me", { intent: "presencePing" }, withDeviceHeader()).then((r) => r.data),

  // ---------------------------------------------------------------------------
  // Listing social (likes/comments)
  // ---------------------------------------------------------------------------
  toggleListingLike: (listingId) =>
    api.post("/listings", { intent: "toggleListingLike", listingId }, withDeviceHeader()).then((r) => r.data),

  listListingComments: (listingId) =>
    api
      .get("/listings", withDeviceHeader({ params: { public: "listingComments", listingId } }))
      .then((r) => r.data),

  addListingComment: (listingId, body) => {
    // stable for 60s to prevent accidental double-submits
    const idem = getOrCreateIdempotencyKey(makeKey(["idem", "comment", listingId]), 60 * 1000);
    const cfg = withIdempotencyHeader(withDeviceHeader(), idem);
    return api.post("/listings", { intent: "addListingComment", listingId, body }, cfg).then((r) => r.data);
  },

  // ---------------------------------------------------------------------------
  // Bids
  // ---------------------------------------------------------------------------
  listListingBids: (listingId) =>
    api.get("/listings", withDeviceHeader({ params: { public: "listingBids", listingId } })).then((r) => r.data),

  addListingBid: (listingId, amount) => {
    // stable for 30s per (listingId+amount) to prevent duplicate bids on double-click
    const idem = getOrCreateIdempotencyKey(makeKey(["idem", "bid", listingId, String(amount)]), 30 * 1000);
    const cfg = withIdempotencyHeader(withDeviceHeader(), idem);
    return api.post("/listings", { intent: "addListingBid", listingId, amount }, cfg).then((r) => r.data);
  },

  startEscrow: (listingId, method) =>
  api.post("/listings", { intent: "startEscrow", listingId, method }).then((r) => r.data),

  submitEscrowPayment: ({ escrowId, reference, proofUrl, note }) =>
  api
    .post("/listings", { intent: "submitEscrowPayment", escrowId, reference, proofUrl, note })
    .then((r) => r.data),
};