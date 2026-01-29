import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, authLoading, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!authLoading && !user) {
      openAuthModal();
      navigate("/marketplace", { replace: true, state: { from: location.pathname } });
    }
  }, [authLoading, user, openAuthModal, navigate, location.pathname]);

  if (authLoading) return null;
  if (!user) return null;

  return children;
}