import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { DollarSign, Image as ImageIcon, BadgeCheck } from "lucide-react";
import ShareSheet from "../shared/ShareSheet";

const platformClasses = (p) => {
  if (p === "YouTube") return "bg-red-500/10 text-red-300 border-red-500/20";
  if (p === "Instagram") return "bg-pink-500/10 text-pink-300 border-pink-500/20";
  if (p === "TikTok") return "bg-zinc-500/10 text-zinc-200 border-zinc-500/20";
  if (p === "Telegram") return "bg-sky-500/10 text-sky-300 border-sky-500/20";
  return "bg-blue-500/10 text-blue-300 border-blue-500/20";
};

function initialsFromUsername(username) {
  if (!username) return "U";
  return username.slice(0, 2).toUpperCase();
}

function SellerHandle({ username }) {
  if (username) return <span className="truncate text-sm text-muted-foreground">@{username}</span>;

  return (
    <span
      className="truncate text-sm text-muted-foreground select-none blur-[3px]"
      title="Seller username not set"
    >
      @private_seller
    </span>
  );
}

export default function ListingCard({ listing }) {
  const navigate = useNavigate();

  const verified = Boolean(listing?.seller?.isVerified);
  const username = listing?.seller?.username || "";
  const categoryName = listing?.category?.name;

  const shareUrl = useMemo(() => {
    // simplest share: direct listing URL
    return `${window.location.origin}/listings/${listing.id}`;
  }, [listing.id]);

  return (
    <Card
      className="group cursor-pointer overflow-hidden rounded-2xl border-border/60 bg-card/60 backdrop-blur
                 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5 hover:border-primary/25"
      onClick={() => navigate(`/listings/${listing.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") navigate(`/listings/${listing.id}`);
      }}
    >
      {/* Image */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
        {listing.image ? (
          <img
            src={listing.image}
            alt={listing.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ImageIcon className="h-6 w-6" />
          </div>
        )}

        {/* gradient overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/70 via-background/10 to-transparent" />

        {/* top-left platform badge */}
        <div className="absolute left-3 top-3">
          <Badge variant="outline" className={platformClasses(listing.platform)}>
            {listing.platform}
          </Badge>
        </div>

        {/* top-right actions: price + share */}
        <div className="absolute right-3 top-3 flex items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-sm font-semibold backdrop-blur">
            <DollarSign className="h-4 w-4 text-primary" />
            <span>{listing.price}</span>
          </div>

          {/* Share button (stop card click) */}
          <div
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <ShareSheet
              url={shareUrl}
              title={listing.title}
              text={(listing.description || "").slice(0, 120)}
            />
          </div>
        </div>

        {/* bottom-left category chip */}
        {categoryName ? (
          <div className="absolute bottom-3 left-3">
            <Badge variant="outline" className="border-border/60 bg-background/60 backdrop-blur">
              {categoryName}
            </Badge>
          </div>
        ) : null}
      </div>

      <CardContent className="space-y-3 p-4">
        {/* Title */}
        <div className="space-y-1">
          <h3 className="line-clamp-2 text-sm font-semibold tracking-tight">{listing.title}</h3>
        </div>

        {/* Seller row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {/* Avatar */}
            <div
              className={[
                "grid h-9 w-9 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                verified
                  ? "border-primary/25 bg-primary/10 text-primary"
                  : "border-border/60 bg-muted/20 text-muted-foreground",
              ].join(" ")}
              title={username ? `@${username}` : "Seller username not set"}
            >
              {initialsFromUsername(username)}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1 min-w-0">
                <SellerHandle username={username} />
                {verified ? (
                  <span
                    className="inline-flex items-center gap-1 text-xs text-primary"
                    title="Verified seller"
                  >
                    <BadgeCheck className="h-4 w-4" />
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {verified ? (
            <Badge className="bg-primary text-primary-foreground">Verified</Badge>
          ) : (
            <span className="text-xs text-muted-foreground opacity-0 transition group-hover:opacity-100">
              View
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}