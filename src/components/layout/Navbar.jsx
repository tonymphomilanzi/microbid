import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../ui/button";
import {
  HomeIcon,
  ShoppingBagIcon,
  Squares2X2Icon,
  ArrowRightOnRectangleIcon,
} from "@heroicons/react/24/outline";

export default function Navbar() {
  const { user, logout, openAuthModal } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
        
          <span>Microbid</span>
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                isActive ? "bg-muted font-medium" : "hover:bg-muted"
              }`
            }
          >
            <HomeIcon className="h-5 w-5" />
            <span className="hidden sm:inline">Home</span>
          </NavLink>

          <NavLink
            to="/marketplace"
            className={({ isActive }) =>
              `inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                isActive ? "bg-muted font-medium" : "hover:bg-muted"
              }`
            }
          >
            <ShoppingBagIcon className="h-5 w-5" />
            <span className="hidden sm:inline">Marketplace</span>
          </NavLink>

          {user && (
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                  isActive ? "bg-muted font-medium" : "hover:bg-muted"
                }`
              }
            >
              <Squares2X2Icon className="h-5 w-5" />
              <span className="hidden sm:inline">Dashboard</span>
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <Button
              variant="outline"
              onClick={async () => {
                await logout();
                navigate("/marketplace");
              }}
              className="gap-2"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
              Logout
            </Button>
          ) : (
            <Button onClick={openAuthModal} className="gap-2">
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
              Login
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}