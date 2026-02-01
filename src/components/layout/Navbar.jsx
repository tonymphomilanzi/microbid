import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../ui/button";
import {
  HomeIcon,
  ShoppingBagIcon,
  Squares2X2Icon,
  ArrowRightOnRectangleIcon,
  ShieldCheckIcon,
  BellIcon,
  UserCircleIcon,
  NewspaperIcon,
} from "@heroicons/react/24/outline";

export default function Navbar() {
  const { user, openAuthModal, unreadChats, unreadFeed, isAdmin } = useAuth();
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
            end
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

          {/* Feed */}
          <NavLink
            to="/feed"
            className={({ isActive }) =>
              `relative inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                isActive ? "bg-muted font-medium" : "hover:bg-muted"
              }`
            }
          >
            <div className="relative">
              <NewspaperIcon className="h-5 w-5" />

              {/* only show feed badge when logged in */}
              {user && unreadFeed > 0 ? (
                <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-primary px-1.5 py-0.5 text-center text-[11px] font-semibold text-primary-foreground shadow">
                  {unreadFeed > 99 ? "99+" : unreadFeed}
                </span>
              ) : null}
            </div>
            <span className="hidden sm:inline">Feed</span>
          </NavLink>

       
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              {/* Chat bell */}
              <button
                onClick={() => navigate("/dashboard?tab=inbox")}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted"
                aria-label="Chat notifications"
                title="Inbox"
              >
                <BellIcon className="h-6 w-6" />
                {unreadChats > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-primary px-1.5 py-0.5 text-center text-[11px] font-semibold text-primary-foreground shadow">
                    {unreadChats > 99 ? "99+" : unreadChats}
                  </span>
                )}
              </button>

              {/* Dashboard shortcut */}
              <button
                onClick={() => navigate("/dashboard")}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted"
                aria-label="Account"
                title="Dashboard"
              >
                <UserCircleIcon className="h-6 w-6" />
              </button>

              {/* Admin shortcut */}
              {isAdmin ? (
                <button
                  onClick={() => navigate("/admin")}
                  className="hidden sm:inline-flex items-center rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-muted"
                >
                  Admin
                </button>
              ) : null}
            </>
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