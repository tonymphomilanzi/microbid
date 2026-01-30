import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { useAuth } from "../context/AuthContext";
import { listingsService } from "../services/listings.service";
import { MessageCircle, CreditCard } from "lucide-react";
import ChatDialog from "../components/chat/ChatDialog";

export default function ListingDetails() {
  const { id } = useParams();
  const { user, openAuthModal } = useAuth();

  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState(null);
  const [error, setError] = useState("");

  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function run() {
      setLoading(true);
      setError("");
      setListing(null);

      try {
        const { listing } = await listingsService.getListing(id);
        if (mounted) setListing(listing);
      } catch (e) {
        const msg = e?.response?.data?.message || e.message || "Failed to load listing";
        if (mounted) setError(msg);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (id) run();
    return () => (mounted = false);
  }, [id]);

  async function buy() {
    try {
      if (!user) return openAuthModal();
      const { checkoutUrl } = await listingsService.checkout(id);
      window.location.href = checkoutUrl;
    } catch (e) {
      alert(e?.response?.data?.message || e.message || "Checkout failed");
    }
  }

  function chat() {
    if (!user) return openAuthModal();
    setChatOpen(true);
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="py-10 text-sm text-muted-foreground">Loading...</div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <div className="py-10 space-y-2">
          <div className="text-sm font-medium">Could not load listing</div>
          <div className="text-sm text-destructive">{error}</div>
        </div>
      </PageContainer>
    );
  }

  if (!listing) {
    return (
      <PageContainer>
        <div className="py-10 text-sm text-muted-foreground">Listing not found.</div>
      </PageContainer>
    );
  }

  const m = listing.metrics || {};
  const isOwner = Boolean(user && listing?.sellerId === user.uid);

  return (
    <PageContainer>
      <div className="py-8 space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="overflow-hidden rounded-xl border bg-muted">
            <img
              src={listing.image}
              alt={listing.title}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-2xl font-semibold tracking-tight">{listing.title}</h1>
              <Badge variant="outline">{listing.platform}</Badge>
            </div>

            <p className="text-sm text-muted-foreground">{listing.description}</p>

            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Price</div>
                  <div className="text-lg font-semibold">${listing.price}</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Seller</div>
                  <div className="text-sm font-medium truncate">{listing.seller?.email}</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Followers/Subs</div>
                  <div className="text-base font-semibold">{m.followers ?? "—"}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Avg Views</div>
                  <div className="text-base font-semibold">{m.avgViews ?? "—"}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Engagement</div>
                  <div className="text-base font-semibold">
                    {m.engagementRate ? `${m.engagementRate}%` : "—"}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Monetized</div>
                  <div className="text-base font-semibold">
                    {typeof m.monetized === "boolean" ? (m.monetized ? "Yes" : "No") : "—"}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={buy} className="gap-2">
                <CreditCard className="h-4 w-4" />
                Buy with Stripe
              </Button>

              <Button
                variant="outline"
                onClick={chat}
                className="gap-2"
                disabled={isOwner}
                title={isOwner ? "You cannot message your own listing" : "Message seller"}
              >
                <MessageCircle className="h-4 w-4" />
                {isOwner ? "Your listing" : "Message Seller"}
              </Button>
            </div>

      
          </div>
        </div>

        <ChatDialog
          open={chatOpen}
          onOpenChange={setChatOpen}
          currentUser={user}
          listing={listing}
        />
      </div>
    </PageContainer>
  );
}