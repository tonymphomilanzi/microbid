import axios from "axios";
import { auth } from "../firebase";

export const api = axios.create({
  baseURL: "/api",
});

function getDeviceId() {
  const key = "microbid_device_id"; // <- look for this in Local Storage
  let id = localStorage.getItem(key);

  if (!id) {
    id =
      (window.crypto?.randomUUID?.() ||
        `${Date.now()}_${Math.random().toString(16).slice(2)}`);
    localStorage.setItem(key, id);
  }

  return id;
}

api.interceptors.request.use(async (config) => {
  // ✅Always attach device id (guest unique views)
  try {
    config.headers["X-Device-Id"] = getDeviceId();
  } catch {
    // ignore
  }

  // Attach auth token if logged in
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});