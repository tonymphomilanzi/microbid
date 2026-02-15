import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { Switch } from "../ui/switch";
import { Badge } from "../ui/badge";
import { listingsService } from "../../services/listings.service";
import ImageUpload from "./ImageUpload";
import { Info, Loader2 } from "lucide-react";

const MAX_EXTRA_IMAGES = 6;

const defaultMetrics = (platform) => {
  if (platform === "YouTube") {
    return {
      followers: 0,
      avgViews: 0,
      engagementRate: 0,
      monetized: false,
      niche: "",
      countryTop: "",
    };
  }
  return {
    followers: 0,
    avgViews: 0,
    engagementRate: 0,
    monetized: false,
    niche: "",
    countryTop: "",
  };
};

export default function CreateListingForm({ initial }) {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [metaLoading, setMetaLoading] = useState(true);
  const [error, setError] = useState("");

  const [platforms, setPlatforms] = useState([]);
  const [categories, setCategories] = useState([]);
  const [meRole, setMeRole] = useState("USER"); // from /api/me

  const [form, setForm] = useState({
    id: "",
    title: "",
    platform: "",
    categoryId: "",
    price: "",
    income: "",   // NEW
    expense: "", //NEW
    description: "",
    image: "", // cover image
    images: [], // extra gallery images (max 6)
    status: "ACTIVE",
    metrics: defaultMetrics("YouTube"),
  });

  // Load platforms + categories + role
  useEffect(() => {
    let mounted = true;

    async function run() {
      setMetaLoading(true);
      try {
        const [{ platforms }, { categories }, me] = await Promise.all([
          listingsService.getPlatforms(),
          listingsService.getCategories(),
          listingsService.me(),
        ]);

        if (!mounted) return;

        setPlatforms(platforms ?? []);
        setMeRole(me?.user?.role ?? "USER");

        // Hide admin-only categories for non-admin
        const filteredCats = (categories ?? []).filter((c) =>
          me?.user?.role === "ADMIN" ? true : !c.isAdminOnly
        );

        setCategories(filteredCats);

        // Set defaults for new listing only (not edit)
        setForm((f) => {
          const defaultPlatform = f.platform || (platforms?.[0]?.name ?? "YouTube");
          const defaultCategoryId = f.categoryId || (filteredCats?.[0]?.id ?? "");

          return {
            ...f,
            platform: defaultPlatform,
            categoryId: defaultCategoryId,
            metrics: defaultMetrics(defaultPlatform),
          };
        });
      } finally {
        if (mounted) setMetaLoading(false);
      }
    }

    run();
    return () => (mounted = false);
  }, []);

  // Prefill edit
  useEffect(() => {
    if (!initial) return;

    setForm({
      id: initial.id,
      title: initial.title ?? "",
      platform: initial.platform ?? "YouTube",
      categoryId: initial.categoryId ?? "",
      price: String(initial.price ?? ""),
      income: initial.income == null ? "" : String(initial.income),     // NEW
      expense: initial.expense == null ? "" : String(initial.expense),  // NEW
      description: initial.description ?? "",
      image: initial.image ?? "",
      images: initial.images ?? [], // <-- important
      status: initial.status ?? "ACTIVE",
      metrics: initial.metrics ?? defaultMetrics(initial.platform ?? "YouTube"),
    });
  }, [initial]);

  // Reset metrics when platform changes (new listing only)
  useEffect(() => {
    if (form.id) return;
    if (!form.platform) return;
    setForm((f) => ({ ...f, metrics: defaultMetrics(f.platform) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.platform]);

  const hints = useMemo(() => {
    if (form.platform === "YouTube") {
      return {
        followersLabel: "Subscribers",
        followersHelp: "Total subscribers on the channel.",
        avgViewsLabel: "Avg views (last 10 videos)",
        avgViewsHelp: "Average views from the last ~10 uploads.",
        engagementHelp: "Optional. If unknown, keep 0.",
      };
    }
    if (form.platform === "Instagram") {
      return {
        followersLabel: "Followers",
        followersHelp: "Total followers on the page.",
        avgViewsLabel: "Avg views (Reels)",
        avgViewsHelp: "Average views per Reel (estimate is OK).",
        engagementHelp: "Engagement rate (%) based on likes/comments/saves.",
      };
    }
    if (form.platform === "TikTok") {
      return {
        followersLabel: "Followers",
        followersHelp: "Total followers on the profile.",
        avgViewsLabel: "Avg views (last 10 videos)",
        avgViewsHelp: "Average views from last ~10 posts.",
        engagementHelp: "Engagement rate (%) optional.",
      };
    }
    return {
      followersLabel: "Followers",
      followersHelp: "Total followers.",
      avgViewsLabel: "Avg views",
      avgViewsHelp: "Average views per post (estimate).",
      engagementHelp: "Optional engagement rate (%).",
    };
  }, [form.platform]);

  const canSubmit =
    form.title.trim() &&
    form.platform &&
    String(form.price).trim() &&
    form.description.trim() &&
    form.image &&
    !metaLoading;

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    if (!canSubmit) {
      setError("Please fill all required fields and upload a cover image.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        income: String(form.income).trim() === "" ? null : Number(form.income),     // NEW
        expense: String(form.expense).trim() === "" ? null : Number(form.expense), // NEW
        metrics: form.metrics ?? null,
        categoryId: form.categoryId || null,
        images: (form.images ?? []).filter(Boolean).slice(0, MAX_EXTRA_IMAGES),
      };

      const { listing } = await listingsService.upsertListing(payload);
      navigate(`/listings/${listing.id}`);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to save listing.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span>{form.id ? "Edit Listing" : "Create Listing"}</span>
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
            {form.platform || "Platform"}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-2">
          {/* LEFT */}
          <div className="space-y-6">
            {/* BASIC */}
            <section className="space-y-4">
              <div>
                <Label>Title *</Label>
                <Input
                  placeholder='e.g. "Monetized YouTube channel in Finance (25k subs)"'
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Clear title helps buyers decide fast: niche + size + monetization.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Platform *</Label>
                  <select
                    className="mt-1 h-10 w-full rounded-md border border-border/60 bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    value={form.platform}
                    onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
                    disabled={metaLoading}
                  >
                    {platforms.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">Platforms are admin-managed.</p>
                </div>

                <div>
                  <Label>Category</Label>
                  <select
                    className="mt-1 h-10 w-full rounded-md border border-border/60 bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    value={form.categoryId}
                    onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                    disabled={metaLoading}
                  >
                    <option value="">No category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {meRole === "ADMIN" && c.isAdminOnly ? " (Admin only)" : ""}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Categories are admin-managed. Streaming Kit is admin-only.
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <Label>Price (USD) *</Label>
                  <Input
                    placeholder="e.g. 1200"
                    inputMode="numeric"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    required
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Enter the full price in USD (numbers only).
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
  <div  className="sm:col-span-2">
    <Label>Income (USD)*</Label>
    <Input
      placeholder="e.g. 500"
      inputMode="numeric"
      value={form.income}
      onChange={(e) => setForm((f) => ({ ...f, income: e.target.value }))}
    />
     <p className="mt-1 text-xs text-muted-foreground">
                    Enter income generated by the channel/profile (e.g. ad revenue, sponsorships, affiliate).
                  </p>
  </div>

  <div  className="sm:col-span-2">
    <Label>Expenses(USD)*</Label>
    <Input
      placeholder="e.g. 120"
      inputMode="numeric"
      value={form.expense}
      onChange={(e) => setForm((f) => ({ ...f, expense: e.target.value }))}
    /><p className="mt-1 text-xs text-muted-foreground">
                    Enter espenses related to the channel/profile (e.g. content creation, ads, tools).
                  </p>
  </div>
</div>
              </div>

              <div>
                <Label>Description *</Label>
                <Textarea
                  placeholder={
                    "Include:\n• Niche + audience\n• What’s included\n• Monetization status\n• Reason for selling\n• Any restrictions (strikes, copyrights)"
                  }
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={9}
                  required
                />
              </div>
            </section>

            <Separator className="bg-border/60" />

            {/* METRICS */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold">Metrics (shown on listing details)</div>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Info className="h-4 w-4" />
                  Buyer-facing
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>{hints.followersLabel}</Label>
                  <Input
                    placeholder="e.g. 25000"
                    inputMode="numeric"
                    value={form.metrics.followers ?? 0}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        metrics: { ...f.metrics, followers: Number(e.target.value) },
                      }))
                    }
                  />
                  <p className="mt-1 text-xs text-muted-foreground">{hints.followersHelp}</p>
                </div>

                <div>
                  <Label>{hints.avgViewsLabel}</Label>
                  <Input
                    placeholder="e.g. 18000"
                    inputMode="numeric"
                    value={form.metrics.avgViews ?? 0}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        metrics: { ...f.metrics, avgViews: Number(e.target.value) },
                      }))
                    }
                  />
                  <p className="mt-1 text-xs text-muted-foreground">{hints.avgViewsHelp}</p>
                </div>

                <div>
                  <Label>Engagement rate (%)</Label>
                  <Input
                    placeholder="e.g. 4.2"
                    inputMode="decimal"
                    value={form.metrics.engagementRate ?? 0}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        metrics: { ...f.metrics, engagementRate: Number(e.target.value) },
                      }))
                    }
                  />
                  <p className="mt-1 text-xs text-muted-foreground">{hints.engagementHelp}</p>
                </div>

                <div className="space-y-2">
                  <Label>Monetized?</Label>
                  <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                    <span className="text-sm text-muted-foreground">Toggle if enabled</span>
                    <Switch
                      checked={Boolean(form.metrics.monetized)}
                      onCheckedChange={(v) =>
                        setForm((f) => ({ ...f, metrics: { ...f.metrics, monetized: v } }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label>Niche (optional)</Label>
                  <Input
                    placeholder='e.g. "Finance", "Fitness", "Gaming"'
                    value={form.metrics.niche ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, metrics: { ...f.metrics, niche: e.target.value } }))
                    }
                  />
                </div>

                <div>
                  <Label>Top country (optional)</Label>
                  <Input
                    placeholder='e.g. "US", "UK", "Nigeria"'
                    value={form.metrics.countryTop ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        metrics: { ...f.metrics, countryTop: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>
            </section>

            <Separator className="bg-border/60" />

            {/* STATUS + SUBMIT */}
            <section className="hidden lg:grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Listing status</Label>
                <select
                  className="mt-1 h-10 w-full rounded-md border border-border/60 bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="ACTIVE">Active (visible)</option>
                  <option value="INACTIVE">Inactive (hidden)</option>
                </select>
              </div>

              <div className="flex items-end">
                <Button type="submit" className="w-full" disabled={!canSubmit || loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : form.id ? (
                    "Save Changes"
                  ) : (
                    "Create Listing"
                  )}
                </Button>
              </div>
            </section>

            {error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}
          </div>

          {/* RIGHT */}
          <div className="space-y-4">
            <div>
              <div className="text-sm font-semibold">Cover image *</div>
              <p className="text-xs text-muted-foreground">
                Use a clear screenshot of analytics or branding.
              </p>
            </div>

            <ImageUpload
              value={form.image}
              onChange={(url) => setForm((f) => ({ ...f, image: url }))}
              mode="cover"
            />

            <Separator className="bg-border/60" />

            <div>
              <div className="text-sm font-semibold">More images (optional)</div>
              <p className="text-xs text-muted-foreground">
                Add up to {MAX_EXTRA_IMAGES} extra images 
              </p>

              <div className="mt-3 grid grid-cols-3 gap-3">
                {Array.from({ length: MAX_EXTRA_IMAGES }).map((_, idx) => (
                  <ImageUpload
                    key={idx}
                    mode="tile"
                    value={form.images?.[idx] ?? ""}
                    onChange={(url) => {
                      setForm((f) => {
                        const next = [...(f.images ?? [])];
                        next[idx] = url;
                        return { ...f, images: next.slice(0, MAX_EXTRA_IMAGES) };
                      });
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Mobile submit button (under other photos) */}
<div className="lg:hidden">
  <Separator className="my-4 bg-border/60" />

  <div className="space-y-3">
    <div>
      <Label>Listing status</Label>
      <select
        className="mt-1 h-10 w-full rounded-md border border-border/60 bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        value={form.status}
        onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
      >
        <option value="ACTIVE">Active (visible)</option>
        <option value="INACTIVE">Inactive (hidden)</option>
      </select>
    </div>

    <Button type="submit" className="w-full" disabled={!canSubmit || loading}>
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Saving...
        </>
      ) : form.id ? (
        "Save Changes"
      ) : (
        "Create Listing"
      )}
    </Button>

    {error ? (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        {error}
      </div>
    ) : null}
  </div>
</div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
