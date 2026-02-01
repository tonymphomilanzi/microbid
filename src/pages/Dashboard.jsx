import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { listingsService } from "../services/listings.service";
import {
  PlusCircle,
  Trash2,
  Pencil,
  Power,
  BarChart3,
  MessageCircle,
} from "lucide-react";

import ChatDialog from "../components/chat/ChatDialog";
import { chatService } from "../services/chat.service";
import ConfirmDeleteDialog from "../components/ui/ConfirmDeleteDialog";
import { useAuth } from "../context/AuthContext";
import UsernameSetupDialog from "../components/forms/UsernameSetupDialog";


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

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [error, setError] = useState("");

  const { isAdmin,refreshMe } = useAuth();
  
  /////////////////
  // Plans (from /api/me)
const [plans, setPlans] = useState([]);
const [currentPlan, setCurrentPlan] = useState(null);
const [usage, setUsage] = useState(null);
const [pendingUpgradeRequest, setPendingUpgradeRequest] = useState(null);
////////////////////////////////////
  //
  const [sp, setSp] = useSearchParams();
  const tab = sp.get("tab") || "";
  //username states
  const [usernameDialogOpen, setUsernameDialogOpen] = useState(false);

  useEffect(() => {
  if (tab === "settings") {
    setUsernameDialogOpen(true);
  }
}, [tab]);


  // Inbox
  const [convosLoading, setConvosLoading] = useState(true);
  const [inboxError, setInboxError] = useState("");
  const [conversations, setConversations] = useState([]);
  const [activeConvoId, setActiveConvoId] = useState("");
  const [inboxOpen, setInboxOpen] = useState(false);
  //delete state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [listingToDelete, setListingToDelete] = useState(null);

  async function loadInbox() {
    setInboxError("");
    setConvosLoading(true);
    try {
      const { conversations } = await chatService.list();
      setConversations(conversations || []);
    } catch (e) {
      setInboxError(e?.response?.data?.message || e.message || "Failed to load inbox");
    } finally {
      setConvosLoading(false);
    }
  }


  async function refresh() {
  setError("");
  setLoading(true);
  try {
    const res = await listingsService.me();

    // backwards-safe destructuring
    const user = res.user || res.user?.user || res.user; // just in case
    const plans = res.plans || [];
    const currentPlan = res.currentPlan || null;
    const usage = res.usage || null;
    const pendingUpgradeRequest = res.pendingUpgradeRequest || null;

    setMe(user);
    setPlans(plans);
    setCurrentPlan(currentPlan);
    setUsage(usage);
    setPendingUpgradeRequest(pendingUpgradeRequest);

    await loadInbox();
  } catch (e) {
    setError(e?.response?.data?.message || e.message || "Failed to load dashboard");
  } finally {
    setLoading(false);
  }
}

  useEffect(() => {
    refresh();
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
         
          <div className="flex gap-2">
            <Button variant="outline" onClick={refresh}>
              Refresh
            </Button>

            <Button asChild className="gap-2">
              <Link to="/create">
                <PlusCircle className="h-4 w-4" />
                Create Listing
              </Link>
            </Button>
             {isAdmin && (
    <Button asChild variant="outline">
      <Link to="/admin">Admin Panel</Link>
    </Button>
  )}

          </div>
        </div>


         {me && !me.username ? (
  <div className="rounded-xl border border-primary/25 bg-primary/10 p-4">
    <div className="text-sm font-semibold">Set your username</div>
    <div className="mt-1 text-sm text-muted-foreground">
      Your email is private. Choose a unique username to show publicly on your listings.
    </div>
    <div className="mt-3">
     <Button onClick={() => setSp({ tab: "settings" }, { replace: true })}>
  Set username
</Button>
    </div>
  </div>
) : null}



{currentPlan ? (
  <div className="rounded-xl border border-border/60 bg-card/60 p-4">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-semibold">
          Current plan: {currentPlan.name} • {currentPlan.billingType}
        </div>

        <div className="mt-1 text-sm text-muted-foreground">
          Listings/month: {currentPlan.features?.listingsPerMonth ?? "—"} • Conversations/month:{" "}
          {currentPlan.features?.conversationsPerMonth ?? "—"}
        </div>

        {usage ? (
          <div className="mt-1 text-xs text-muted-foreground">
            This month usage: listings {usage.listingsCreated ?? 0} /{" "}
            {currentPlan.features?.listingsPerMonth ?? "—"} • conversations{" "}
            {usage.conversationsStarted ?? 0} /{" "}
            {currentPlan.features?.conversationsPerMonth ?? "—"}
          </div>
        ) : null}

        {pendingUpgradeRequest ? (
          <div className="mt-2 text-xs text-primary">
            Upgrade request pending: {pendingUpgradeRequest.requestedPlan}
          </div>
        ) : null}
      </div>

      <Button asChild variant="outline">
        <Link to="/pricing">Upgrade</Link>
      </Button>
    </div>
  </div>
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

        <Tabs defaultValue="listings">
          <TabsList>
            <TabsTrigger value="listings">My Listings</TabsTrigger>
            <TabsTrigger value="inbox" className="gap-2">
  <MessageCircle className="h-4 w-4" />
  Inbox
  {conversations?.some((c) => c.unreadCount > 0) ? (
    <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
      {conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0)}
    </span>
  ) : null}
</TabsTrigger>
            <TabsTrigger value="purchases">Purchases</TabsTrigger>
            <TabsTrigger value="sales">Sales</TabsTrigger>
          </TabsList>

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
  {/*added trash icon*/}
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

          {/* INBOX */}
          <TabsContent value="inbox" className="mt-4 space-y-3">
  {inboxError ? (
    <Card className="border-border/60 bg-card/60">
      <CardContent className="p-5">
        <div className="text-sm font-medium">Could not load inbox</div>
        <div className="mt-1 text-sm text-muted-foreground">{inboxError}</div>
        <div className="mt-4">
          <Button variant="outline" onClick={loadInbox}>Retry inbox</Button>
        </div>
      </CardContent>
    </Card>
  ) : null}

  {convosLoading ? (
    <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading inbox…</CardContent></Card>
  ) : !conversations.length ? (
    <Card><CardContent className="p-6 text-sm text-muted-foreground">No conversations yet.</CardContent></Card>
  ) : (
    <div className="grid gap-2">
      {conversations.map((c) => {
        const lastText = c.messages?.[0]?.text ?? "No messages yet";
        const otherEmail = c.buyerId === me?.id ? c.seller?.email : c.buyer?.email;
        const otherName = otherEmail?.split("@")[0] || "User";
        const initials = otherName
          .split(/[.\s_-]+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((p) => p[0]?.toUpperCase())
          .join("");

        const unread = (c.unreadCount || 0) > 0;

        const ts = c.lastMessageAt || c.updatedAt;
        const timeLabel = ts ? new Date(ts).toLocaleString() : "";

        return (
          <button
            key={c.id}
            onClick={() => {
              setActiveConvoId(c.id);
              setInboxOpen(true);
            }}
            className={[
              "w-full text-left rounded-xl border p-3 transition",
              "border-border/60 bg-card/60 hover:bg-muted/20",
              unread ? "ring-1 ring-primary/30 bg-primary/5" : "",
            ].join(" ")}
          >
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div
                className={[
                  "h-10 w-10 shrink-0 rounded-full grid place-items-center border text-sm font-semibold",
                  unread
                    ? "border-primary/30 bg-primary/15 text-primary"
                    : "border-border/60 bg-muted/20 text-muted-foreground",
                ].join(" ")}
              >
                {initials || "U"}
              </div>

              {/* Main */}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className={["truncate text-sm", unread ? "font-semibold" : "font-medium"].join(" ")}>
                      {otherEmail || "Unknown"}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <Badge variant="outline" className="border-border/60 bg-muted/20">
                        {c.listing?.platform}
                      </Badge>
                      <span className="truncate text-xs text-muted-foreground">
                        {c.listing?.title}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 text-xs text-muted-foreground">
                    {timeLabel}
                  </div>
                </div>

                <div className={["mt-2 truncate text-sm", unread ? "text-foreground" : "text-muted-foreground"].join(" ")}>
                  {lastText}
                </div>
              </div>

              {/* Listing thumb + unread badge */}
              <div className="flex items-center gap-2">
                {unread ? (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                    {c.unreadCount}
                  </span>
                ) : null}

                {c.listing?.image ? (
                  <img
                    src={c.listing.image}
                    alt="Listing"
                    className="h-10 w-14 rounded-md object-cover border border-border/60"
                  />
                ) : null}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  )}

  <ChatDialog
    open={inboxOpen}
    onOpenChange={(o) => {
      setInboxOpen(o);
      // when closing chat, refresh inbox so unread counts update immediately
      if (!o) loadInbox();
    }}
    currentUser={me ? { uid: me.id } : null}
    conversationId={activeConvoId || undefined}
  />
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
      </div>

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
    setUsernameDialogOpen(open);
    if (!open) setSp({}, { replace: true }); // clears ?tab=settings
  }}
  initialUsername={me?.username || ""}
  onSaved={async (newUsername) => {
    await refreshMe?.();
    setMe((prev) => (prev ? { ...prev, username: newUsername } : prev));
    setSp({}, { replace: true });
  }}
/>


    </PageContainer>
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