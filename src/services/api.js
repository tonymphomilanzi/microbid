import axios from "axios";
import { auth } from "../firebase";

export const api = axios.create({
  baseURL: "/api",
});

function getDeviceId() {
  const key = "microbid_device_id";
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
  config.headers = config.headers ?? {};

  // ✅ always attach a stable device id
  try {
    config.headers["X-Device-Id"] = getDeviceId();
  } catch {
    // ignore
  }

  // ✅ attach auth token if logged in
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});