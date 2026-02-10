import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { listingsService } from "../services/listings.service";

export default function usePresencePing() {
  const { user, authReady } = useAuth();

  useEffect(() => {
    if (!authReady || !user) return;

    let alive = true;

    const ping = async () => {
      try {
        await listingsService.presencePing();
      } catch {
        // ignore
      }
    };

    // initial ping
    ping();

    const interval = setInterval(() => {
      if (!alive) return;
      if (document.visibilityState === "visible") ping();
    }, 30_000);

    const onVisible = () => {
      if (document.visibilityState === "visible") ping();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      alive = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [authReady, user?.uid]);
}