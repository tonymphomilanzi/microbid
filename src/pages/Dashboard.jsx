import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { listingsService } from "../services/listings.service";
import AvatarSetupDialog from "../components/forms/AvatarSetupDialog";
import UsernameSetupDialog from "../components/forms/UsernameSetupDialog";
import ConfirmDeleteDialog from "../components/ui/ConfirmDeleteDialog";
import { useAuth } from "../context/AuthContext";

import {
  PlusCircle,
  Trash2,
  Pencil,
  Power,
  BarChart3,
  LogOut,
  Settings,
  Sparkles,
  TrendingUp,
  Crown,
  Zap,
} from "lucide-react";

function StatusBadge({ status }) {
  const map = {
    ACTIVE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    INACTIVE: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20",
    SOLD: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  };
  return (
    <Badge variant="outline" className={map[status] ?? ""}>
      {status}
    </Badge>
  );
}

function formatLimit(value) {
  if (value === null || value === undefined) return "—";
  if (value < 0) return "Unlimited";
  return String(value);
}

function isUnlimited(value) {
  return typeof value === "number" && value < 0;
}

function UsageProgress({ used, limit, label }) {
  const unlimited = isUnlimited(limit);
  const percent = unlimited ? 0 : limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const atLimit = !unlimited && limit > 0 && used >= limit;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={atLimit ? "text-red-400 font-semibold" : "text-foreground"}>
          {used} / {formatLimit(limit)}
        </span>
      </div>
      {!unlimited && limit > 0 ? (
        <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
          <div
            className={[
              "h-full rounded-full transition-all",
              atLimit ? "bg-red-500" : percent > 80 ? "bg-yellow-500" : "bg-primary",
            ].join(" ")}
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : (
        <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-primary/30 via-primary/50 to-primary/30" />
      )}
    </div>
  );
}

function PlanBadge({ name }) {
  const config = {
    FREE: { color: "bg-zinc-500/10 text-zinc-300 border-zinc-500/30", icon: Zap },
    PRO: { color: "bg-blue-500/10 text-blue-400 border-blue-500/30", icon: TrendingUp },
    VIP: { color: "bg-amber-500/10 text-amber-400 border-amber-500/30", icon: Crown },
    ADMIN: { color: "bg-purple-500/10 text-purple-400 border-purple-500/30", icon: Sparkles },
  };

  const cfg = config[name?.toUpperCase()] || config.FREE;
  const Icon = cfg.icon;

  return (
    <Badge variant="outline" className={`${cfg.color} gap-1`}>
      <Icon className="h-3 w-3" />
      {name}
    </Badge>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const { isAdmin, refreshMe, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [error, setError] = useState("");

  // Plans (from /api/me)
  const [plans, setPlans] = useState([]);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [usage, setUsage] = useState(null);
  const [pendingUpgradeRequest, setPendingUpgradeRequest] = useState(null);

  // URL params
  const [sp, setSp] = useSearchParams();

  // Backward compatibility:
  // old links used ?tab=avatar or ?tab=settings
  const rawTab = sp.get("tab") || "";
  const rawModal = sp.get("modal") || "";

  const tabParam = rawTab === "avatar" ? "settings" : rawTab;
  const modalParam = rawTab === "avatar" ? "avatar" : rawModal;

  const activeTab = useMemo(() => {
    const allowed = new Set(["listings", "purchases", "sales", "settings"]);
    return allowed.has(tabParam) ? tabParam : "listings";
  }, [tabParam]);

  const usernameDialogOpen = activeTab === "settings" && modalParam === "username";
  const avatarDialogOpen = activeTab === "settings" && modalParam === "avatar";

  function setTab(next) {
    const nextSp = new URLSearchParams(sp);
    nextSp.delete("modal");

    if (!next || next === "listings") nextSp.delete("tab");
    else nextSp.set("tab", next);

    setSp(nextSp, { replace: true });
  }

  function openSettingsModal(which) {
    const nextSp = new URLSearchParams(sp);
    nextSp.set("tab", "settings");
    nextSp.set("modal", which);
    setSp(nextSp, { replace: true });
  }

  function closeSettingsModal() {
    const nextSp = new URLSearchParams(sp);
    nextSp.delete("modal");
    nextSp.set("tab", "settings");
    setSp(nextSp, { replace: true });
  }

  // Delete state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [listingToDelete, setListingToDelete] = useState(null);

  async function refresh() {
    setError("");
    setLoading(true);
    try {
      const res = await listingsService.me();

      const user = res.user || res.user?.user || res.user;
      setMe(user);

      setPlans(res.plans || []);
      setCurrentPlan(res.currentPlan || null);
      setUsage(res.usage || null);
      setPendingUpgradeRequest(res.pendingUpgradeRequest || null);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => {
    const listings = me?.listings ?? [];
    const active = listings.filter((l) => l.status === "ACTIVE").length;
    const inactive = listings.filter((l) => l.status === "INACTIVE").length;
    const sold = listings.filter((l) => l.status === "SOLD").length;

    return {
      total: listings.length,
      active,
      inactive,
      sold,
      purchases: me?.purchases?.length ?? 0,
      sales: me?.sales?.length ?? 0,
    };
  }, [me]);

  async function removeListingConfirmed() {
    if (!listingToDelete?.id) return;

    setDeleteLoading(true);
    try {
      await listingsService.deleteListing(listingToDelete.id);
      setDeleteOpen(false);
      setListingToDelete(null);
      await refresh();
    } finally {
      setDeleteLoading(false);
    }
  }

  async function toggleActive(listing) {
    await listingsService.upsertListing({
      id: listing.id,
      title: listing.title,
      platform: listing.platform,
      price: listing.price,
      description: listing.description,
      image: listing.image,
      metrics: listing.metrics ?? null,
      status: listing.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
    });
    refresh();
  }

  const defaultAvatar = "/avatar-default.png";

  const pendingPlanName = pendingUpgradeRequest?.requestedPlan;
  const pendingMatchesCurrent =
    pendingPlanName && currentPlan?.name?.toUpperCase() === pendingPlanName?.toUpperCase();
  const upgradeApproved = pendingUpgradeRequest && pendingMatchesCurrent;

  return (
    <PageContainer>
      <div className="py-8 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
            <p className="text-sm text-muted-foreground">
              {me?.username ? `@${me.username}` : "Username not set"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={refresh}>
              Refresh
            </Button>

            <Button asChild className="gap-2">
              <Link to="/create">
                <PlusCircle className="h-4 w-4" />
                Create Listing
              </Link>
            </Button>

            {isAdmin ? (
              <Button asChild variant="outline">
                <Link to="/admin">Admin Panel</Link>
              </Button>
            ) : null}

            <Button variant="outline" className="gap-2" onClick={logout}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* Missing username banner */}
        {me && !me.username ? (
          <div className="rounded-xl border border-primary/25 bg-primary/10 p-4">
            <div className="text-sm font-semibold">Set your username</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Your email is private. Choose a unique username to show publicly on your listings.
            </div>
            <div className="mt-3">
              <Button onClick={() => openSettingsModal("username")}>Set username</Button>
            </div>
          </div>
        ) : null}

        {/* Missing avatar banner */}
        {me && !me.avatarUrl ? (
          <div className="rounded-xl border border-primary/25 bg-primary/10 p-4">
            <div className="text-sm font-semibold">Set your avatar</div>
            <div className="mt-1 text-sm text-muted-foreground">Add a profile image.</div>
            <div className="mt-3">
              <Button onClick={() => openSettingsModal("avatar")}>Set avatar</Button>
            </div>
          </div>
        ) : null}

        {/* Upgrade approved banner */}
        {upgradeApproved ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-400" />
              <div className="text-sm font-semibold text-emerald-400">
                Upgrade approved! You're now on {currentPlan?.name}
              </div>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Your upgrade request to {pendingPlanName} has been approved. Enjoy your new features!
            </div>
          </div>
        ) : null}

        {/* Plan & Usage Card */}
        {currentPlan ? (
          <Card className="border-border/60 bg-card/60">
            <CardContent className="p-5 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">Current plan:</span>
                    <PlanBadge name={currentPlan.name} />
                    <Badge variant="outline" className="text-xs">
                      {currentPlan.billingType}
                    </Badge>
                  </div>

                  {currentPlan.tagline ? (
                    <div className="text-xs text-muted-foreground">{currentPlan.tagline}</div>
                  ) : null}
                </div>

                {currentPlan.name !== "ADMIN" && currentPlan.name !== "VIP" ? (
                  <Button asChild variant="outline" size="sm" className="gap-2">
                    <Link to="/pricing">
                      <TrendingUp className="h-4 w-4" />
                      Upgrade
                    </Link>
                  </Button>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <UsageProgress
                  used={usage?.listingsCreated ?? 0}
                  limit={currentPlan.features?.listingsPerMonth}
                  label="Listings created this month"
                />
                <UsageProgress
                  used={usage?.conversationsStarted ?? 0}
                  limit={currentPlan.features?.conversationsPerMonth}
                  label="New conversations this month"
                />
              </div>

              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">
                    {formatLimit(currentPlan.features?.listingsPerMonth)}
                  </span>{" "}
                  listings/month
                </div>
                <div>
                  <span className="font-medium text-foreground">
                    {formatLimit(currentPlan.features?.conversationsPerMonth)}
                  </span>{" "}
                  new conversations/month
                </div>
              </div>

              {pendingUpgradeRequest && !pendingMatchesCurrent ? (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-sm font-medium text-primary">
                      Upgrade request pending: {pendingUpgradeRequest.requestedPlan}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Your request is being reviewed. You'll be notified when it's approved.
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {error ? (
          <Card className="border-border/60 bg-card/60">
            <CardContent className="p-5">
              <div className="text-sm font-medium">Could not load dashboard</div>
              <div className="mt-1 text-sm text-muted-foreground">{error}</div>
              <div className="mt-4">
                <Button variant="outline" onClick={refresh}>
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Summary */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total listings", value: summary.total },
            { label: "Active", value: summary.active },
            { label: "Purchases", value: summary.purchases },
            { label: "Sales", value: summary.sales },
          ].map((x) => (
            <Card key={x.label} className="border-border/60 bg-card/60 backdrop-blur">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">{x.label}</div>
                <div className="mt-1 text-lg font-semibold">{loading ? "…" : x.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="listings">My Listings</TabsTrigger>
            <TabsTrigger value="purchases">Purchases</TabsTrigger>
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* SETTINGS */}
          <TabsContent value="settings" className="mt-4 space-y-3">
            <Card className="border-border/60 bg-card/60">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 overflow-hidden rounded-full border border-border/60 bg-muted/20">
                    <img
                      src={me?.avatarUrl || defaultAvatar}
                      alt="Avatar"
                      className="h-full w-full object-cover"
                      onError={(e) => (e.currentTarget.src = defaultAvatar)}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-semibold">Profile</div>
                    <div className="text-sm text-muted-foreground truncate">
                      {me?.username ? `@${me.username}` : "Username not set"}
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button variant="outline" onClick={() => openSettingsModal("avatar")}>
                    Change avatar
                  </Button>
                  <Button variant="outline" onClick={() => openSettingsModal("username")}>
                    Change username
                  </Button>
                </div>
              </CardContent>
            </Card>

            {currentPlan ? (
              <Card className="border-border/60 bg-card/60">
                <CardContent className="p-5 space-y-3">
                  <div className="text-sm font-semibold">Subscription</div>

                  <div className="flex items-center gap-3">
                    <PlanBadge name={currentPlan.name} />
                    <span className="text-sm text-muted-foreground">{currentPlan.billingType}</span>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>
                      Listings per month:{" "}
                      <span className="text-foreground font-medium">
                        {formatLimit(currentPlan.features?.listingsPerMonth)}
                      </span>
                    </div>
                    <div>
                      New conversations per month:{" "}
                      <span className="text-foreground font-medium">
                        {formatLimit(currentPlan.features?.conversationsPerMonth)}
                      </span>
                    </div>
                  </div>

                  {currentPlan.name !== "ADMIN" && currentPlan.name !== "VIP" ? (
                    <Button asChild variant="outline" size="sm">
                      <Link to="/pricing">View plans</Link>
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          {/* LISTINGS */}
          <TabsContent value="listings" className="mt-4 space-y-3">
            {loading ? (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent>
              </Card>
            ) : !me?.listings?.length ? (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">No listings yet.</CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {me.listings.map((l) => {
                  const m = l.metrics || {};
                  return (
                    <Card key={l.id} className="border-border/60 bg-card/60">
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="truncate font-medium">{l.title}</div>
                              <StatusBadge status={l.status} />
                              <Badge variant="outline" className="border-border/60 bg-muted/30">
                                {l.platform}
                              </Badge>
                            </div>

                            <div className="text-sm text-muted-foreground">
                              ${l.price} • Created {new Date(l.createdAt).toLocaleDateString()}
                            </div>

                            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                              <MiniMetric label="Followers" value={m.followers ?? "—"} />
                              <MiniMetric label="Avg Views" value={m.avgViews ?? "—"} />
                              <MiniMetric
                                label="Engagement"
                                value={m.engagementRate ? `${m.engagementRate}%` : "—"}
                              />
                              <MiniMetric
                                label="Monetized"
                                value={
                                  typeof m.monetized === "boolean"
                                    ? m.monetized
                                      ? "Yes"
                                      : "No"
                                    : "—"
                                }
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 sm:justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={() => toggleActive(l)}
                            >
                              <Power className="h-4 w-4" />
                              {l.status === "ACTIVE" ? "Deactivate" : "Activate"}
                            </Button>

                            <Button variant="outline" size="sm" className="gap-2" asChild>
                              <Link to={`/create?edit=${l.id}`}>
                                <Pencil className="h-4 w-4" />
                                Edit
                              </Link>
                            </Button>

                            <Button
                              variant="destructive"
                              size="sm"
                              className="gap-2"
                              onClick={() => {
                                setListingToDelete(l);
                                setDeleteOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>

                            <Button variant="secondary" size="sm" className="gap-2" asChild>
                              <Link to={`/listings/${l.id}`}>
                                <BarChart3 className="h-4 w-4" />
                                View
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* PURCHASES */}
          <TabsContent value="purchases" className="mt-4 space-y-3">
            {loading ? (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent>
              </Card>
            ) : !me?.purchases?.length ? (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">No purchases yet.</CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {me.purchases.map((p) => (
                  <Card key={p.id} className="border-border/60 bg-card/60">
                    <CardContent className="p-4">
                      <div className="font-medium">{p.listing?.title}</div>
                      <div className="text-sm text-muted-foreground">
                        ${p.amount} • {new Date(p.createdAt).toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* SALES */}
          <TabsContent value="sales" className="mt-4 space-y-3">
            {loading ? (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent>
              </Card>
            ) : !me?.sales?.length ? (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">No sales yet.</CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {me.sales.map((s) => (
                  <Card key={s.id} className="border-border/60 bg-card/60">
                    <CardContent className="p-4">
                      <div className="font-medium">{s.listing?.title}</div>
                      <div className="text-sm text-muted-foreground">
                        ${s.amount} • {new Date(s.createdAt).toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <ConfirmDeleteDialog
          open={deleteOpen}
          onOpenChange={(o) => {
            setDeleteOpen(o);
            if (!o) setListingToDelete(null);
          }}
          loading={deleteLoading}
          title="Delete this listing?"
          description={
            listingToDelete
              ? `You're about to delete "${listingToDelete.title}". This cannot be undone.`
              : "This action cannot be undone."
          }
          confirmText="Delete listing"
          onConfirm={removeListingConfirmed}
        />

        <UsernameSetupDialog
          open={usernameDialogOpen}
          onOpenChange={(open) => {
            if (!open) closeSettingsModal();
          }}
          initialUsername={me?.username || ""}
          onSaved={async (newUsername) => {
            await refreshMe?.();
            setMe((prev) => (prev ? { ...prev, username: newUsername } : prev));
            closeSettingsModal();
          }}
        />

        <AvatarSetupDialog
          open={avatarDialogOpen}
          onOpenChange={(open) => {
            if (!open) closeSettingsModal();
          }}
          initialAvatarUrl={me?.avatarUrl || ""}
          onSaved={async (newUrl) => {
            await refreshMe?.();
            setMe((prev) => (prev ? { ...prev, avatarUrl: newUrl } : prev));
            closeSettingsModal();
          }}
        />
      </div>
    </PageContainer>
  );
}