import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { listingsService } from "../services/listings.service";
import { chatService } from "../services/chat.service";
import { feedService } from "../services/feed.service";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Firebase auth user
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // UI auth modal
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // DB user from /api/me
  const [me, setMe] = useState(null);
  const [meLoading, setMeLoading] = useState(false);

  // unread counters
  const [unreadChats, setUnreadChats] = useState(0);
  const [unreadFeed, setUnreadFeed] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const openAuthModal = useCallback(() => setAuthModalOpen(true), []);
  const closeAuthModal = useCallback(() => setAuthModalOpen(false), []);

  const resetAuthedState = useCallback(() => {
    setMe(null);
    setUnreadChats(0);
    setUnreadFeed(0);
    setUnreadNotifications(0);
  }, []);

  const refreshMe = useCallback(async () => {
    if (!auth.currentUser) {
      resetAuthedState();
      return;
    }

    setMeLoading(true);
    try {
      // /api/me GET returns:
      // { user, plans, currentPlan, usage, pendingUpgradeRequest, unreadNotificationsCount }
      const res = await listingsService.me();

      const dbUser = res?.user || null;
      setMe(dbUser);

      // ✅ new
      setUnreadNotifications(Number(res?.unreadNotificationsCount || 0));
    } catch {
      resetAuthedState();
    } finally {
      setMeLoading(false);
    }
  }, [resetAuthedState]);

  // Firebase auth session bootstrap
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthLoading(false);

      if (u) {
        await refreshMe();
      } else {
        resetAuthedState();
      }
    });

    return () => unsub();
  }, [refreshMe, resetAuthedState]);

  // Poll chat unread
  useEffect(() => {
    if (!user || !me?.id) {
      setUnreadChats(0);
      return;
    }

    let alive = true;

    async function poll() {
      try {
        const { conversations } = await chatService.list();

        const total = (conversations || []).reduce((sum, c) => {
          if (typeof c.unreadCount === "number") return sum + c.unreadCount;

          const fallback =
            c.buyerId === me.id ? Number(c.buyerUnread || 0) : Number(c.sellerUnread || 0);

          return sum + fallback;
        }, 0);

        if (alive) setUnreadChats(total);
      } catch {
        // ignore
      }
    }

    poll();
    const t = setInterval(poll, 6000);

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [user, me?.id]);

  // Poll feed unread
  useEffect(() => {
    if (!user || !me?.id) {
      setUnreadFeed(0);
      return;
    }

    let alive = true;

    async function poll() {
      try {
        const { unreadFeedCount } = await feedService.unreadCount();
        if (alive) setUnreadFeed(Number(unreadFeedCount || 0));
      } catch {
        // ignore
      }
    }

    poll();
    const t = setInterval(poll, 15000);

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [user, me?.id]);

  // Poll notifications unread (lightweight enough at 30s)
  // NOTE: this requires listingsService.getNotifications() to exist
  useEffect(() => {
    if (!user || !me?.id) {
      setUnreadNotifications(0);
      return;
    }

    let alive = true;

    async function poll() {
      try {
        const res = await listingsService.getNotifications?.();
        if (!alive) return;

        // backend returns { unreadCount }
        if (res && typeof res.unreadCount !== "undefined") {
          setUnreadNotifications(Number(res.unreadCount || 0));
        }
      } catch {
        // ignore (notifications feature may not be deployed yet)
      }
    }

    poll();
    const t = setInterval(poll, 30000);

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [user, me?.id]);

  const isAdmin = me?.role === "ADMIN";
  const username = me?.username || null;

  const logout = useCallback(async () => {
    closeAuthModal();
    resetAuthedState();
    await signOut(auth);
  }, [closeAuthModal, resetAuthedState]);

  const value = useMemo(
    () => ({
      user,

      authLoading,
      authReady: !authLoading,

      authModalOpen,
      openAuthModal,
      closeAuthModal,

      me,
      meLoading,
      refreshMe,

      isAdmin,
      username,

      unreadChats,
      unreadFeed,
      unreadNotifications,

      logout,
    }),
    [
      user,
      authLoading,
      authModalOpen,
      openAuthModal,
      closeAuthModal,
      me,
      meLoading,
      refreshMe,
      isAdmin,
      username,
      unreadChats,
      unreadFeed,
      unreadNotifications,
      logout,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);