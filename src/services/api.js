import axios from "axios";
import { auth } from "../firebase";

export const api = axios.create({ baseURL: "/api" });

function getDeviceId() {
  const key = "mikrobid_device_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id =
      (crypto?.randomUUID?.() ||
        `${Date.now()}_${Math.random().toString(16).slice(2)}`);
    localStorage.setItem(key, id);
  }
  return id;
}

api.interceptors.request.use(async (config) => {
  // always send device id (guest unique views)
  try {
    config.headers["X-Device-Id"] = getDeviceId();
  } catch {
    // ignore
  }

  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});