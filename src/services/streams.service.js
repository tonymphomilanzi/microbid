// src/services/streams.service.js
import { api } from "./api";

// -----------------------------
// Device id header (same idea as listings.service)
// Backend expects: "x-device-id" for unique view counting.
// -----------------------------
const DEVICE_ID_KEY = "device_id_v1";

function getOrCreateDeviceId() {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;

    const next =
      (window.crypto?.randomUUID && window.crypto.randomUUID()) ||
      `d_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    window.localStorage.setItem(DEVICE_ID_KEY, next);
    return next;
  } catch {
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

export const streamsService = {
  // -----------------------------
  // Public
  // -----------------------------
  getStreams: (params) =>
    api.get("/streams", withDeviceHeader({ params })).then((r) => r.data),

  // This GET also triggers view recording (best-effort) on backend
  getStream: (id) =>
    api.get(`/streams/${id}`, withDeviceHeader()).then((r) => r.data),

  // -----------------------------
  // Upload helpers (admin)
  // -----------------------------
  uploadCoverImage: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("/upload", fd, withDeviceHeader()).then((r) => r.data);
  },

  uploadVideo: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("/upload-video", fd, withDeviceHeader()).then((r) => r.data);
  },

  // -----------------------------
  // Admin CRUD
  // -----------------------------
  adminListStreams: (params) =>
    api.get("/admin/streams", withDeviceHeader({ params })).then((r) => r.data),

  adminCreateStream: (payload) =>
    api.post("/admin/streams", payload, withDeviceHeader()).then((r) => r.data),

  adminUpdateStream: (id, payload) =>
    api.patch("/admin/streams", payload, withDeviceHeader({ params: { id } })).then((r) => r.data),

  adminDeleteStream: (id) =>
    api.delete("/admin/streams", withDeviceHeader({ params: { id } })).then((r) => r.data),
};