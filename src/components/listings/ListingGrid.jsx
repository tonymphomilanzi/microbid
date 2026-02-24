import { useEffect, useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import ListingFilters from "../components/listings/ListingFilters";
import ListingGrid from "../components/listings/ListingGrid";
import { listingsService } from "../services/listings.service";
import { Button } from "../components/ui/button";
import { PlusCircle, Radio } from "lucide-react";

const STREAMING_KITS_SLUG = "streaming-kit";

export default function Marketplace() {
  const [sp, setSp] = useSearchParams();

  const [filters, setFilters] = useState({
    platform: sp.get("platform") || "",
    categoryId: sp.get("categoryId") || "",
    q: sp.get("q") || "",
    minPrice: sp.get("minPrice") || "",
    maxPrice: sp.get("maxPrice") || "",
  });

  const [loading, setLoading] = useState(true);
  const [allListings, setAllListings] = useState([]);

  // Keep URL in sync (shareable marketplace state)
  useEffect(() => {
    const next = {};
    if (filters.platform) next.platform = filters.platform;
    if (filters.categoryId) next.categoryId = filters.categoryId;
    if (filters.q) next.q = filters.q;
    if (filters.minPrice) next.minPrice = filters.minPrice;
    if (filters.maxPrice) next.maxPrice = filters.maxPrice;

    setSp(next, { replace: true });
  }, [filters, setSp]);

  useEffect(() => {
    let mounted = true;

    async function run() {
      setLoading(true);
      try {
        const { listings } = await listingsService.getListings({
          platform: filters.platform || undefined,
          categoryId: filters.categoryId || undefined,
          q: filters.q || undefined,
          minPrice: filters.minPrice || undefined,
          maxPrice: filters.maxPrice || undefined,
        });

        if (mounted) setAllListings(listings ?? []);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    run();
    return () => (mounted = false);
  }, [filters]);

  // Helper to check if a listing is a streaming kit
  const isStreamingKit = (listing) => {
    const slug = listing?.category?.slug?.toLowerCase();
    const name = listing?.category?.name?.toLowerCase();
    return slug === STREAMING_KITS_SLUG || name === "streaming-kit" || name === "streaming kit";
  };

  // Separate listings into regular and streaming kits
  const { regularListings, streamingKitListings } = useMemo(() => {
    const regular = [];
    const kits = [];

    for (const listing of allListings) {
      if (isStreamingKit(listing)) {
        kits.push(listing);
      } else {
        regular.push(listing);
      }
    }

    return { regularListings: regular, streamingKitListings: kits };
  }, [allListings]);

  // Check if user is filtering specifically for streaming kits
  const isFilteringStreamingKits = useMemo(() => {
    // If the categoryId filter matches streaming kit, show all in one section
    // This requires knowing the streaming kit category ID, or we check by results
    return allListings.length > 0 && regularListings.length === 0 && streamingKitListings.length > 0;
  }, [allListings, regularListings, streamingKitListings]);

  return (
    <PageContainer>
      <div className="py-8 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">Marketplace</h2>
            <p className="text-sm text-muted-foreground">
              Browse listings without logging in. Login is required to buy or contact sellers.
            </p>
          </div>

          <Button asChild className="gap-2">
            <Link to="/create">
              <PlusCircle className="h-4 w-4" />
              Create Listing
            </Link>
          </Button>
        </div>

        <ListingFilters filters={filters} setFilters={setFilters} />

        {/* If filtering specifically for streaming kits, show them as main content */}
        {isFilteringStreamingKits ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold tracking-tight">Streaming Kits</h3>
              <span className="text-sm text-muted-foreground">
                ({streamingKitListings.length} {streamingKitListings.length === 1 ? "listing" : "listings"})
              </span>
            </div>
            <ListingGrid listings={streamingKitListings} loading={loading} />
          </div>
        ) : (
          <>
            {/* Regular Listings Section */}
            <div className="space-y-4">
              {regularListings.length > 0 || loading ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold tracking-tight">All Listings</h3>
                      {!loading && (
                        <span className="text-sm text-muted-foreground">
                          ({regularListings.length} {regularListings.length === 1 ? "listing" : "listings"})
                        </span>
                      )}
                    </div>
                  </div>
                  <ListingGrid listings={regularListings} loading={loading} />
                </>
              ) : null}

              {/* Show empty state only if no listings at all */}
              {!loading && regularListings.length === 0 && streamingKitListings.length === 0 && (
                <ListingGrid listings={[]} loading={false} />
              )}
            </div>

            {/* Streaming Kits Section */}
            {(streamingKitListings.length > 0 || loading) && (
              <div className="space-y-4 pt-6 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold tracking-tight">Streaming Kits</h3>
                    {!loading && (
                      <span className="text-sm text-muted-foreground">
                        ({streamingKitListings.length} {streamingKitListings.length === 1 ? "listing" : "listings"})
                      </span>
                    )}
                  </div>
                </div>

                {!loading && streamingKitListings.length === 0 ? (
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      No streaming kits match your current filters.
                    </p>
                  </div>
                ) : (
                  <ListingGrid listings={streamingKitListings} loading={loading} />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
}