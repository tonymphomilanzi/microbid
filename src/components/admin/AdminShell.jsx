import { NavLink, Outlet, Link } from "react-router-dom";
import { Sheet, SheetContent, SheetTrigger } from "../ui/sheet";
import { Button } from "../ui/button";
import {
  Squares2X2Icon,
  UsersIcon,
  TagIcon,
  RectangleStackIcon,
  ListBulletIcon,
  Bars3Icon,
  ArrowLeftIcon,
  NewspaperIcon,
  Cog6ToothIcon,
  ShieldCheckIcon, //  NEW
  VideoCameraIcon,
  CreditCardIcon, // NEW
} from "@heroicons/react/24/outline";

const nav = [
  { to: "/admin", label: "Overview", Icon: Squares2X2Icon },
  { to: "/admin/users", label: "Users", Icon: UsersIcon },
  { to: "/admin/listings", label: "Listings", Icon: ListBulletIcon },
  { to: "/admin/platforms", label: "Platforms", Icon: RectangleStackIcon },
  { to: "/admin/categories", label: "Categories", Icon: TagIcon },
  { to: "/admin/feed", label: "Feed", Icon: NewspaperIcon },
  { to: "/admin/streams", label: "Streams", Icon: VideoCameraIcon },
  { to: "/admin/pages", label: "Pages", Icon: ListBulletIcon }, // or any icon you prefer
  { to: "/admin/subscriptions", label: "Subscriptions", Icon: RectangleStackIcon },
  { to: "/admin/subscription-payments", label: "Sub Payments", Icon: CreditCardIcon },

  //  NEW: Escrows queue
  { to: "/admin/escrows", label: "Escrows", Icon: ShieldCheckIcon },

  { to: "/admin/settings", label: "Settings", Icon: Cog6ToothIcon },
];

function Sidebar() {
  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-border/60 lg:bg-card/40">
      <div className="flex h-16 items-center justify-between px-4 border-b border-border/60">
        <div className="font-semibold tracking-tight">Mikrobid Admin</div>
      </div>

      <div className="p-3 space-y-1">
        {nav.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/admin"}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                isActive ? "bg-muted/60 font-medium" : "hover:bg-muted/40"
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </div>

      <div className="mt-auto p-3">
        <Button asChild variant="outline" className="w-full gap-2">
          <Link to="/marketplace">
            <ArrowLeftIcon className="h-5 w-5" />
            Back to app
          </Link>
        </Button>
      </div>
    </aside>
  );
}

export default function AdminShell() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="flex">
        <Sidebar />

        <div className="flex-1">
          {/* Topbar */}
          <div className="sticky top-16 z-40 border-b border-border/60 bg-background/70 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
              <div className="flex items-center gap-2 lg:hidden">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Bars3Icon className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-72 bg-card">
                    <div className="mb-4 font-semibold">Microbid Admin</div>
                    <div className="space-y-1">
                      {nav.map(({ to, label, Icon }) => (
                        <NavLink
                          key={to}
                          to={to}
                          end={to === "/admin"}
                          className={({ isActive }) =>
                            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                              isActive ? "bg-muted/60 font-medium" : "hover:bg-muted/40"
                            }`
                          }
                        >
                          <Icon className="h-5 w-5" />
                          {label}
                        </NavLink>
                      ))}
                    </div>

                    <div className="mt-6">
                      <Button asChild variant="outline" className="w-full">
                        <Link to="/marketplace">Back to app</Link>
                      </Button>
                    </div>
                  </SheetContent>
                </Sheet>

                <div className="font-semibold tracking-tight">Admin</div>
              </div>

              <div className="hidden lg:block text-sm text-muted-foreground">
                Control center • moderation • settings
              </div>

              <div className="text-xs text-muted-foreground"></div>
            </div>
          </div>

          <main className="mx-auto w-full max-w-6xl px-4 py-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}