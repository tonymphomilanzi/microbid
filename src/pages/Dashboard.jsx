import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { listingsService } from "../services/listings.service";
import { PlusCircle, Trash2, Pencil, Power, BarChart3 } from "lucide-react";

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

  async function refresh() {
    setError("");
    setLoading(true);
    try {
      const { user } = await listingsService.me();
      setMe(user);
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

  async function removeListing(id) {
    await listingsService.deleteListing(id);
    refresh();
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
            <p className="text-sm text-muted-foreground">{me?.email}</p>
          </div>

          <Button asChild className="gap-2">
            <Link to="/create">
              <PlusCircle className="h-4 w-4" />
              Create Listing
            </Link>
          </Button>
        </div>

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
            <TabsTrigger value="purchases">Purchases</TabsTrigger>
            <TabsTrigger value="sales">Sales</TabsTrigger>
          </TabsList>

          <TabsContent value="listings" className="mt-4 space-y-3">
            {loading ? (
              <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent></Card>
            ) : !me?.listings?.length ? (
              <Card><CardContent className="p-6 text-sm text-muted-foreground">No listings yet.</CardContent></Card>
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
                              <MiniMetric label="Monetized" value={typeof m.monetized === "boolean" ? (m.monetized ? "Yes" : "No") : "—"} />
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
                              onClick={() => removeListing(l.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
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

          <TabsContent value="purchases" className="mt-4 space-y-3">
            {loading ? (
              <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent></Card>
            ) : !me?.purchases?.length ? (
              <Card><CardContent className="p-6 text-sm text-muted-foreground">No purchases yet.</CardContent></Card>
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

          <TabsContent value="sales" className="mt-4 space-y-3">
            {loading ? (
              <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent></Card>
            ) : !me?.sales?.length ? (
              <Card><CardContent className="p-6 text-sm text-muted-foreground">No sales yet.</CardContent></Card>
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