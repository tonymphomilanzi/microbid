import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { listingsService } from "../services/listings.service";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [authModalOpen, setAuthModalOpen] = useState(false);

  // NEW: DB user (from /api/me)
  const [me, setMe] = useState(null);
  const [meLoading, setMeLoading] = useState(false);

  async function refreshMe() {
    if (!auth.currentUser) {
      setMe(null);
      return;
    }

    setMeLoading(true);
    try {
      const { user: dbUser } = await listingsService.me();
      setMe(dbUser);
    } catch {
      // If token expired or backend fails, don't block UI
      setMe(null);
    } finally {
      setMeLoading(false);
    }
  }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAdmin = me?.role === "ADMIN";

  const value = useMemo(
    () => ({
      user,
      authLoading,
      authModalOpen,
      openAuthModal: () => setAuthModalOpen(true),
      closeAuthModal: () => setAuthModalOpen(false),
      logout: async () => {
        await signOut(auth);
        setMe(null);
      },

      // NEW exports
      me,
      meLoading,
      refreshMe,
      isAdmin,
    }),
    [user, authLoading, authModalOpen, me, meLoading, isAdmin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);