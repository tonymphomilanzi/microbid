import { createContext, useContext, useEffect, useMemo, useCallback, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { listingsService } from "../services/listings.service";
import { chatService } from "../services/chat.service";
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [authModalOpen, setAuthModalOpen] = useState(false);

  //chat staate
  const [unreadChats, setUnreadChats] = useState(0);

  // DB user from /api/me
  const [me, setMe] = useState(null);
  const [meLoading, setMeLoading] = useState(false);

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
      }
    });

    return () => unsub();
  }, [refreshMe]);

  const isAdmin = me?.role === "ADMIN";
  const username = me?.username || null;

  const logout = useCallback(async () => {
    // close modal + clear state immediately for snappy UI
    setAuthModalOpen(false);
    setMe(null);
    await signOut(auth);
  }, []);

  const value = useMemo(
    () => ({
      user,
      authLoading,

      authModalOpen,
      openAuthModal: () => setAuthModalOpen(true),
      closeAuthModal: () => setAuthModalOpen(false),

      me,
      meLoading,
      refreshMe,

      isAdmin,
      username,

      logout,
    }),
    [user, authLoading, authModalOpen, me, meLoading, refreshMe, isAdmin, username, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);