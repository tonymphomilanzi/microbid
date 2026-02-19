import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetTrigger } from "../ui/sheet";
import {
  HomeIcon,
  ShoppingBagIcon,
  ArrowRightOnRectangleIcon,
  BellIcon,
  UserCircleIcon,
  NewspaperIcon,
  ChatBubbleLeftRightIcon,
  PlayCircleIcon,
  Bars3Icon,
} from "@heroicons/react/24/outline";

export default function Navbar() {
  const { user, authLoading, openAuthModal, unreadChats, unreadFeed, unreadNotifications, isAdmin } =
    useAuth();

  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const desktopNavItem = ({ isActive }) =>
    `inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
      isActive ? "bg-muted font-medium" : "hover:bg-muted"
    }`;

  const mobileTabItem = ({ isActive }) =>
    [
      "relative flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-2 transition",
      isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
    ].join(" ");

  return (
    <>
      {/* TOP BAR */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur overflow-x-clip">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-2 sm:px-4">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight shrink-0">
            <span className="hidden sm:inline">Mikrobid</span>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/60 bg-muted/20 sm:hidden">
              M
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1">
            <NavLink to="/" end className={desktopNavItem}>
              <HomeIcon className="h-5 w-5" />
              Home
            </NavLink>

            <NavLink to="/marketplace" className={desktopNavItem}>
              <ShoppingBagIcon className="h-5 w-5" />
              Marketplace
            </NavLink>

            <NavLink to="/feed" className={({ isActive }) =>
              `relative inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                isActive ? "bg-muted font-medium" : "hover:bg-muted"
              }`
            }>
              <div className="relative">
                <NewspaperIcon className="h-5 w-5" />
                {user && unreadFeed > 0 ? (
                  <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-primary px-1.5 py-0.5 text-center text-[11px] font-semibold text-primary-foreground shadow">
                    {unreadFeed > 99 ? "99+" : unreadFeed}
                  </span>
                ) : null}
              </div>
              Feed
            </NavLink>

            <NavLink to="/streams" className={desktopNavItem}>
              <PlayCircleIcon className="h-5 w-5" />
              Streams
            </NavLink>
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {authLoading ? (
              <div className="h-10 w-24 rounded-md bg-muted/40" />
            ) : user ? (
              <>
                {/* Notifications */}
                <button
                  onClick={() => navigate("/notifications")}
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted"
                  aria-label="Notifications"
                  title="Notifications"
                >
                  <BellIcon className="h-6 w-6" />
                  {unreadNotifications > 0 ? (
                    <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-primary px-1.5 py-0.5 text-center text-[11px] font-semibold text-primary-foreground shadow">
                      {unreadNotifications > 99 ? "99+" : unreadNotifications}
                    </span>
                  ) : null}
                </button>

                {/* Desktop-only quick icons */}
                <button
                  onClick={() => navigate("/dashboard?tab=inbox")}
                  className="relative hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted"
                  aria-label="Inbox"
                  title="Inbox"
                >
                  <ChatBubbleLeftRightIcon className="h-6 w-6" />
                  {unreadChats > 0 ? (
                    <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-primary px-1.5 py-0.5 text-center text-[11px] font-semibold text-primary-foreground shadow">
                      {unreadChats > 99 ? "99+" : unreadChats}
                    </span>
                  ) : null}
                </button>

                <button
                  onClick={() => navigate("/dashboard")}
                  className="hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted"
                  aria-label="Dashboard"
                  title="Dashboard"
                >
                  <UserCircleIcon className="h-6 w-6" />
                </button>

                {isAdmin ? (
                  <button
                    onClick={() => navigate("/admin")}
                    className="hidden sm:inline-flex items-center rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-muted"
                  >
                    Admin
                  </button>
                ) : null}

                {/* Mobile hamburger */}
                <div className="sm:hidden">
                  <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                    <SheetTrigger asChild>
                      <button
                        className="relative inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted"
                        aria-label="Menu"
                        title="Menu"
                      >
                        <Bars3Icon className="h-6 w-6" />
                        {unreadChats > 0 ? (
                          <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-primary px-1.5 py-0.5 text-center text-[11px] font-semibold text-primary-foreground shadow">
                            {unreadChats > 99 ? "99+" : unreadChats}
                          </span>
                        ) : null}
                      </button>
                    </SheetTrigger>

                    <SheetContent side="right" className="w-72 bg-card">
                      <div className="space-y-1">
                        <div className="mb-2 text-sm font-semibold">Menu</div>

                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            navigate("/dashboard?tab=inbox");
                          }}
                          className="relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted/40"
                        >
                          <ChatBubbleLeftRightIcon className="h-5 w-5" />
                          Inbox
                          {unreadChats > 0 ? (
                            <span className="ml-auto min-w-[18px] rounded-full bg-primary px-1.5 py-0.5 text-center text-[11px] font-semibold text-primary-foreground shadow">
                              {unreadChats > 99 ? "99+" : unreadChats}
                            </span>
                          ) : null}
                        </button>

                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            navigate("/dashboard");
                          }}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted/40"
                        >
                          <UserCircleIcon className="h-5 w-5" />
                          Dashboard
                        </button>

                        {isAdmin ? (
                          <button
                            onClick={() => {
                              setMenuOpen(false);
                              navigate("/admin");
                            }}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted/40"
                          >
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-muted/40 text-[11px] font-semibold">
                              A
                            </span>
                            Admin
                          </button>
                        ) : null}
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              </>
            ) : (
              <>
                {/* Desktop login */}
                <Button onClick={openAuthModal} className="hidden sm:inline-flex gap-2">
                  <ArrowRightOnRectangleIcon className="h-5 w-5" />
                  Login
                </Button>

                {/* Mobile login icon */}
                <button
                  onClick={openAuthModal}
                  className="inline-flex sm:hidden h-10 w-10 items-center justify-center rounded-md hover:bg-muted"
                  aria-label="Login"
                  title="Login"
                >
                  <ArrowRightOnRectangleIcon className="h-6 w-6" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* BOTTOM TAB BAR (mobile only) */}
      <div className="sm:hidden fixed inset-x-0 bottom-0 z-50 border-t border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto max-w-6xl px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2">
          <nav className="flex items-stretch gap-1">
            <NavLink to="/" end className={mobileTabItem} aria-label="Home" title="Home">
              <HomeIcon className="h-6 w-6" />
              <span className="text-[11px] font-medium">Home</span>
            </NavLink>

            <NavLink to="/marketplace" className={mobileTabItem} aria-label="Marketplace" title="Marketplace">
              <ShoppingBagIcon className="h-6 w-6" />
              <span className="text-[11px] font-medium">Market</span>
            </NavLink>

            <NavLink to="/feed" className={mobileTabItem} aria-label="Feed" title="Feed">
              <div className="relative">
                <NewspaperIcon className="h-6 w-6" />
                {user && unreadFeed > 0 ? (
                  <span className="absolute -right-2 -top-1 min-w-[18px] rounded-full bg-primary px-1.5 py-0.5 text-center text-[11px] font-semibold text-primary-foreground shadow">
                    {unreadFeed > 99 ? "99+" : unreadFeed}
                  </span>
                ) : null}
              </div>
              <span className="text-[11px] font-medium">Feed</span>
            </NavLink>

            <NavLink to="/streams" className={mobileTabItem} aria-label="Streams" title="Streams">
              <PlayCircleIcon className="h-6 w-6" />
              <span className="text-[11px] font-medium">Streams</span>
            </NavLink>
          </nav>
        </div>
      </div>
    </>
  );
}