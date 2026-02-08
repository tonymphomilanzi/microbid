import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { useAuth } from "../context/AuthContext";
import { listingsService } from "../services/listings.service";
import { MessageCircle, CreditCard, BadgeCheck } from "lucide-react";
import ChatDialog from "../components/chat/ChatDialog";

function SellerHandle({ username }) {
  if (username) {
    return <span className="truncate text-sm font-medium">@{username}</span>;
  }
  // never expose email
  return (
    <span className="truncate text-sm font-medium select-none blur-[3px]" title="Seller username not set">
      @private_seller
    </span>
  );
}

export default function ListingDetails() {
  const { id } = useParams();
  const { user, openAuthModal } = useAuth();

  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState(null);
  const [error, setError] = useState("");

  const [chatOpen, setChatOpen] = useState(false);

  // Gallery state
  const [activeImage, setActiveImage] = useState("");

  useEffect(() => {
  let mounted = true;

  async function run() {
    setLoading(true);
    setError("");
    setListing(null);

    try {
      const { listing } = await listingsService.getListing(id);
      if (!mounted) return;
      setListing(listing);

      const gallery = [listing?.image, ...(listing?.images ?? [])].filter(Boolean);
      const unique = Array.from(new Set(gallery)).slice(0, 7);

      setActiveImage(unique[0] || "");
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

const images = useMemo(() => {
  if (!listing) return [];
  const gallery = [listing?.image, ...(listing?.images ?? [])].filter(Boolean);
  return Array.from(new Set(gallery)).slice(0, 7);
}, [listing]);



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
  const verified = Boolean(listing?.seller?.isVerified);
  const username = listing?.seller?.username || "";

  return (
    <PageContainer>
      <div className="py-8 space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Gallery */}
       {/* Left: Gallery */}
<div className="space-y-3">
  {/* Main image (responsive aspect ratio) */}
  <div className="relative w-full overflow-hidden rounded-xl border border-border/60 bg-muted aspect-[16/10] sm:aspect-[16/9]">
    <img
      src={activeImage || listing.image}
      alt={listing.title}
      className="h-full w-full object-cover"
      loading="lazy"
    />
  </div>

  {/* Thumbnails: grid on mobile, scroll row on bigger screens */}
  {images.length > 1 ? (
    <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-2 sm:overflow-x-auto sm:pb-1 sm:[-ms-overflow-style:none] sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden">
      {images.map((src) => {
        const selected = src === activeImage;

        return (
          <button
            key={src}
            type="button"
            onClick={() => setActiveImage(src)}
            className={[
              "relative overflow-hidden rounded-lg border transition",
              // mobile thumbnail sizing
              "aspect-[4/3] w-full",
              // desktop sizing (scroll row)
              "sm:h-16 sm:w-24 sm:shrink-0 sm:aspect-auto",
              selected
                ? "border-primary/40 ring-2 ring-primary/20"
                : "border-border/60 hover:border-primary/20",
            ].join(" ")}
            title="View image"
          >
            <img
              src={src}
              alt="Listing thumbnail"
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </button>
        );
      })}
    </div>
  ) : null}
</div>

          {/* Right: Details */}
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-2xl font-semibold tracking-tight">{listing.title}</h1>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{listing.platform}</Badge>
                {listing.category?.name ? <Badge variant="outline">{listing.category.name}</Badge> : null}
              </div>
            </div>

           <div className="text-sm text-muted-foreground whitespace-pre-wrap break-words leading-6">
  {listing.description}
</div>

            <div className="grid grid-cols-2 gap-3">
              <Card className="border-border/60 bg-card/60">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Price</div>
                  <div className="text-lg font-semibold">${listing.price}</div>
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-card/60">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Seller</div>

                  <div className="mt-1 flex items-center gap-2 min-w-0">
                    <SellerHandle username={username} />
                    {verified ? (
                      <span className="inline-flex items-center gap-1 text-xs text-primary" title="Verified seller">
                        <BadgeCheck className="h-4 w-4" />
                        Verified
                      </span>
                    ) : null}
                  </div>

                  {!username ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Seller has not set a public username yet.
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Card className="border-border/60 bg-card/60">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Followers/Subs</div>
                  <div className="text-base font-semibold">{m.followers ?? "—"}</div>
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-card/60">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Avg Views</div>
                  <div className="text-base font-semibold">{m.avgViews ?? "—"}</div>
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-card/60">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Engagement</div>
                  <div className="text-base font-semibold">
                    {m.engagementRate ? `${m.engagementRate}%` : "—"}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-card/60">
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