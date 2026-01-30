import { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { listingsService } from "../../services/listings.service";
import { Skeleton } from "../ui/skeleton";

export default function ListingFilters({ filters, setFilters }) {
  const [platforms, setPlatforms] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function run() {
      setLoadingMeta(true);
      try {
        const [{ platforms }, { categories }] = await Promise.all([
          listingsService.getPlatforms(),
          listingsService.getCategories(),
        ]);

        if (!mounted) return;

        setPlatforms(platforms ?? []);
        setCategories(categories ?? []);
      } finally {
        if (mounted) setLoadingMeta(false);
      }
    }

    run();
    return () => (mounted = false);
  }, []);

  const selectedPlatform = useMemo(
    () => filters.platform || "All",
    [filters.platform]
  );

  const selectedCategoryId = useMemo(
    () => filters.categoryId || "",
    [filters.categoryId]
  );

  return (
    <div className="space-y-4">
      {/* Platforms chips */}
      <div className="space-y-2">
        <div className="text-sm font-semibold">Platforms</div>

        {loadingMeta ? (
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-24 rounded-full" />
            ))}
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Button
              variant={!filters.platform ? "default" : "outline"}
              className="shrink-0 rounded-full"
              onClick={() => setFilters((f) => ({ ...f, platform: "" }))}
            >
              All
            </Button>

            {platforms.map((p) => {
              const selected = selectedPlatform === p.name;
              return (
                <Button
                  key={p.id}
                  variant={selected ? "default" : "outline"}
                  className="shrink-0 rounded-full"
                  onClick={() => setFilters((f) => ({ ...f, platform: p.name }))}
                >
                  {p.name}
                </Button>
              );
            })}
          </div>
        )}
      </div>

      {/* Categories chips */}
      <div className="space-y-2">
        <div className="text-sm font-semibold">Categories</div>

        {loadingMeta ? (
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-28 rounded-full" />
            ))}
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Button
              variant={!selectedCategoryId ? "default" : "outline"}
              className="shrink-0 rounded-full"
              onClick={() => setFilters((f) => ({ ...f, categoryId: "" }))}
            >
              All
            </Button>

            {categories.map((c) => {
              const selected = selectedCategoryId === c.id;
              return (
                <Button
                  key={c.id}
                  variant={selected ? "default" : "outline"}
                  className="shrink-0 rounded-full"
                  onClick={() => setFilters((f) => ({ ...f, categoryId: c.id }))}
                >
                  {c.name}
                </Button>
              );
            })}
          </div>
        )}
      </div>

      {/* Search + price */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          placeholder="Search listings..."
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
        />
        <Input
          placeholder="Min price"
          inputMode="numeric"
          value={filters.minPrice}
          onChange={(e) => setFilters((f) => ({ ...f, minPrice: e.target.value }))}
        />
        <Input
          placeholder="Max price"
          inputMode="numeric"
          value={filters.maxPrice}
          onChange={(e) => setFilters((f) => ({ ...f, maxPrice: e.target.value }))}
        />
      </div>
    </div>
  );
}