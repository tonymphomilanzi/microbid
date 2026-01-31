import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { listingsService } from "../../services/listings.service";
import PageContainer from "../layout/PageContainer";

export default function AdminRoute({ children }) {
  const { user, authLoading, openAuthModal } = useAuth();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function run() {
      if (!user) return;
      setChecking(true);
      try {
        const { user: me } = await listingsService.me();
        if (!mounted) return;
        setAllowed(me?.role === "ADMIN");
      } finally {
        if (mounted) setChecking(false);
      }
    }

    if (!authLoading && !user) {
      openAuthModal();
      setChecking(false);
      setAllowed(false);
      return;
    }

    if (user) run();
    return () => (mounted = false);
  }, [user, authLoading, openAuthModal]);

  if (authLoading || checking) {
    return (
      <PageContainer>
        <div className="py-10 text-sm text-muted-foreground">Checking admin access…</div>
      </PageContainer>
    );
  }

  if (!allowed) {
    return (
      <PageContainer>
        <div className="py-10 space-y-2">
          <div className="text-lg font-semibold">Access denied</div>
          <div className="text-sm text-muted-foreground">Admin only.</div>
        </div>
      </PageContainer>
    );
  }

  return children;
}