import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { DollarSign, Image as ImageIcon, User } from "lucide-react";

const platformColor = (p) => {
  if (p === "YouTube") return "bg-red-500/10 text-red-600 border-red-500/20";
  if (p === "Instagram") return "bg-pink-500/10 text-pink-600 border-pink-500/20";
  if (p === "TikTok") return "bg-zinc-500/10 text-zinc-800 border-zinc-500/20";
  return "bg-blue-500/10 text-blue-600 border-blue-500/20";
};

export default function ListingCard({ listing }) {
  const navigate = useNavigate();

  return (
    <Card
      className="group cursor-pointer overflow-hidden transition hover:shadow-md"
      onClick={() => navigate(`/listings/${listing.id}`)}
      role="button"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
        {listing.image ? (
          <img
            src={listing.image}
            alt={listing.title}
            className="h-full w-full object-cover transition group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ImageIcon className="h-6 w-6" />
          </div>
        )}
      </div>

      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 text-sm font-semibold">{listing.title}</h3>
          <Badge variant="outline" className={platformColor(listing.platform)}>
            {listing.platform}
          </Badge>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="inline-flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            <span className="max-w-[140px] truncate">
              {listing.seller?.email ?? "Verified Seller"}
            </span>
          </div>

          <div className="inline-flex items-center gap-1 font-semibold">
            <DollarSign className="h-4 w-4" />
            {listing.price}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}