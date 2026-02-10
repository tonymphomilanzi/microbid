import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  useState,
} from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { listingsService } from "../services/listings.service";
import { chatService } from "../services/chat.service";
import { feedService } from "../services/feed.service";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [authModalOpen, setAuthModalOpen] = useState(false);

  // DB user from /api/me
  const [me, setMe] = useState(null);
  const [meLoading, setMeLoading] = useState(false);

  // chat unread
  const [unreadChats, setUnreadChats] = useState(0);

  // feed unread
  const [unreadFeed, setUnreadFeed] = useState(0);

  const refreshMe = useCallback(async () => {
    if (!auth.currentUser) {
      setMe(null);
      return;
    }

    setMeLoading(true);
    try {
      const { user: dbUser } = await listingsService.me();
      setMe(dbUser);
    } catch {
      setMe(null);
    } finally {
      setMeLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthLoading(false);

      if (u) {
        await refreshMe();
      } else {
        setMe(null);
        setUnreadChats(0);
        setUnreadFeed(0);
      }
    });

    return () => unsub();
  }, [refreshMe]);

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

  const isAdmin = me?.role === "ADMIN";
  const username = me?.username || null;

  const logout = useCallback(async () => {
    setAuthModalOpen(false);
    setMe(null);
    setUnreadChats(0);
    setUnreadFeed(0);
    await signOut(auth);
  }, []);

  const value = useMemo(
    () => ({
      user,

      // existing flag
      authLoading,

      authReady: !authLoading,

      authModalOpen,
      openAuthModal: () => setAuthModalOpen(true),
      closeAuthModal: () => setAuthModalOpen(false),

      me,
      meLoading,
      refreshMe,

      isAdmin,
      username,

      unreadChats,
      unreadFeed,

      logout,
    }),
    [
      user,
      authLoading,
      authModalOpen,
      me,
      meLoading,
      refreshMe,
      isAdmin,
      username,
      unreadChats,
      unreadFeed,
      logout,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);