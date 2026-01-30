import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import ListingFilters from "../components/listings/ListingFilters";
import ListingGrid from "../components/listings/ListingGrid";
import { listingsService } from "../services/listings.service";

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
  const [listings, setListings] = useState([]);

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

        if (mounted) setListings(listings);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    run();
    return () => (mounted = false);
  }, [filters]);

  return (
    <PageContainer>
      <div className="py-8 space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Marketplace</h2>
          <p className="text-sm text-muted-foreground">
            Browse listings without logging in. Login is required to buy or contact sellers.
          </p>
        </div>

        <ListingFilters filters={filters} setFilters={setFilters} />
        <ListingGrid listings={listings} loading={loading} />
      </div>
    </PageContainer>
  );
}