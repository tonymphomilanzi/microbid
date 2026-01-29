import { useMemo } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

const PLATFORMS = ["All", "YouTube", "Instagram", "TikTok", "X", "Facebook"];

export default function ListingFilters({ filters, setFilters }) {
  const active = useMemo(() => filters.platform ?? "All", [filters.platform]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {PLATFORMS.map((p) => {
          const selected = (p === "All" && !filters.platform) || filters.platform === p;
          return (
            <Button
              key={p}
              variant={selected ? "default" : "outline"}
              className="shrink-0 rounded-full"
              onClick={() => setFilters((f) => ({ ...f, platform: p === "All" ? "" : p }))}
            >
              {p}
            </Button>
          );
        })}
      </div>

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