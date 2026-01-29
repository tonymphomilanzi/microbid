import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { listingsService } from "../services/listings.service";
import { Trash2, Pencil, PlusCircle, Power } from "lucide-react";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);

  async function refresh() {
    setLoading(true);
    try {
      const { user } = await listingsService.me();
      setMe(user);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function removeListing(id) {
    await listingsService.deleteListing(id);
    refresh();
  }

  async function toggleActive(listing) {
    await listingsService.upsertListing({
      ...listing,
      metrics: listing.metrics ?? null,
      status: listing.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
    });
    refresh();
  }

  if (loading || !me) {
    return (
      <PageContainer>
        <div className="py-10 text-sm text-muted-foreground">Loading dashboard...</div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="py-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
            <p className="text-sm text-muted-foreground">{me.email}</p>
          </div>

          <Button asChild className="gap-2">
            <Link to="/create">
              <PlusCircle className="h-4 w-4" />
              Create Listing
            </Link>
          </Button>
        </div>

        <Tabs defaultValue="listings">
          <TabsList>
            <TabsTrigger value="listings">My Listings</TabsTrigger>
            <TabsTrigger value="purchases">Purchases</TabsTrigger>
            <TabsTrigger value="sales">Sales</TabsTrigger>
          </TabsList>

          <TabsContent value="listings" className="mt-4 space-y-3">
            {!me.listings?.length ? (
              <Card><CardContent className="p-6 text-sm text-muted-foreground">No listings yet.</CardContent></Card>
            ) : (
              <div className="grid gap-3">
                {me.listings.map((l) => (
                  <Card key={l.id}>
                    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{l.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {l.platform} • ${l.price} • Status: {l.status}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => toggleActive(l)}>
                          <Power className="h-4 w-4" />
                          {l.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          asChild
                        >
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
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="purchases" className="mt-4 space-y-3">
            {!me.purchases?.length ? (
              <Card><CardContent className="p-6 text-sm text-muted-foreground">No purchases yet.</CardContent></Card>
            ) : (
              <div className="grid gap-3">
                {me.purchases.map((p) => (
                  <Card key={p.id}>
                    <CardContent className="p-4">
                      <div className="font-medium">{p.listing.title}</div>
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
            {!me.sales?.length ? (
              <Card><CardContent className="p-6 text-sm text-muted-foreground">No sales yet.</CardContent></Card>
            ) : (
              <div className="grid gap-3">
                {me.sales.map((s) => (
                  <Card key={s.id}>
                    <CardContent className="p-4">
                      <div className="font-medium">{s.listing.title}</div>
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