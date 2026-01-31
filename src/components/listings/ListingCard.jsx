import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import {
  DollarSign,
  Image as ImageIcon,
  User,
  BadgeCheck,
  Sparkles,
} from "lucide-react";

const platformClasses = (p) => {
  if (p === "YouTube") return "bg-red-500/10 text-red-400 border-red-500/20";
  if (p === "Instagram") return "bg-pink-500/10 text-pink-400 border-pink-500/20";
  if (p === "TikTok") return "bg-zinc-500/10 text-zinc-200 border-zinc-500/20";
  if (p === "Telegram") return "bg-sky-500/10 text-sky-300 border-sky-500/20";
  return "bg-blue-500/10 text-blue-300 border-blue-500/20";
};

function initials(email = "") {
  const name = email.split("@")[0] || "user";
  const parts = name.split(/[.\s_-]+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "U";
}

export default function ListingCard({ listing }) {
  const navigate = useNavigate();

  const sellerEmail = listing.seller?.email || "Verified Seller";
  const verified = Boolean(listing.seller?.isVerified);
  const categoryName = listing.category?.name;

  return (
    <Card
      className="group cursor-pointer overflow-hidden border-border/60 bg-card/60 backdrop-blur
                 transition-all hover:-translate-y-0.5 hover:shadow-soft hover:border-primary/25"
      onClick={() => navigate(`/listings/${listing.id}`)}
      role="button"
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

        {/* Overlays */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/70 via-background/10 to-transparent" />

        {/* Platform badge */}
        <div className="absolute left-3 top-3">
          <Badge variant="outline" className={platformClasses(listing.platform)}>
            {listing.platform}
          </Badge>
        </div>

        {/* Price pill */}
        <div className="absolute right-3 top-3">
          <div className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-sm font-semibold backdrop-blur">
            <DollarSign className="h-4 w-4 text-primary" />
            <span>{listing.price}</span>
          </div>
        </div>

        {/* Category chip */}
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
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 text-sm font-semibold tracking-tight">
            {listing.title}
          </h3>

          {/* Small “featured feel” sparkle when verified */}
          {verified ? (
            <div className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[11px] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Trusted
            </div>
          ) : null}
        </div>

        {/* Seller row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border/60 bg-muted/20 text-xs font-semibold text-muted-foreground">
              {initials(sellerEmail)}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="truncate text-sm text-muted-foreground">
                  {sellerEmail}
                </span>
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

          {/* Small hint for clickability */}
          <div className="text-xs text-muted-foreground opacity-0 transition group-hover:opacity-100">
            View
          </div>
        </div>
      </CardContent>
    </Card>
  );
}