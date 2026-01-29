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

const PLATFORMS = ["YouTube", "Instagram", "TikTok", "X", "Facebook"];

const defaultMetrics = (platform) => {
  // keep it simple but clear; stored as JSON in DB
  if (platform === "YouTube") {
    return {
      followers: 0, // subs
      avgViews: 0, // avg views last 10 videos
      engagementRate: 0, // optional
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
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    id: "",
    title: "",
    platform: "YouTube",
    price: "",
    description: "",
    image: "",
    status: "ACTIVE",
    metrics: defaultMetrics("YouTube"),
  });

  // CRITICAL: when initial loads (async), update the form state (fixes edit not prefilling)
  useEffect(() => {
    if (!initial) return;

    setForm({
      id: initial.id,
      title: initial.title ?? "",
      platform: initial.platform ?? "YouTube",
      price: String(initial.price ?? ""),
      description: initial.description ?? "",
      image: initial.image ?? "",
      status: initial.status ?? "ACTIVE",
      metrics: initial.metrics ?? defaultMetrics(initial.platform ?? "YouTube"),
    });
  }, [initial]);

  // When platform changes on a new listing (not editing), reset metrics template
  useEffect(() => {
    if (form.id) return; // don't overwrite metrics on edit
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
        avgViewsHelp: "Average views per Reel (rough estimate is OK).",
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
    form.image;

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    if (!canSubmit) {
      setError("Please fill all required fields and upload an image.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        metrics: form.metrics ?? null,
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
            {form.platform}
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
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Choose where the asset lives.
                  </p>
                </div>

                <div>
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
              </div>

              <div>
                <Label>Description *</Label>
                <Textarea
                  placeholder={
                    "Include:\n• Niche + audience\n• What’s included (email, content, brand deals)\n• Monetization status\n• Reason for selling\n• Any restrictions (copyright strikes, etc.)"
                  }
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={9}
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  The more transparent you are, the faster you sell.
                </p>
              </div>
            </section>

            <Separator className="bg-border/60" />

            {/* METRICS */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold">Metrics (shown on listing details)</div>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Info className="h-4 w-4" />
                  These are buyer-facing.
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
                    <span className="text-sm text-muted-foreground">
                      Toggle if monetization is enabled
                    </span>
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
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <p className="mt-1 text-xs text-muted-foreground">
                  Inactive listings won’t show in the marketplace.
                </p>
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
                Use a clear screenshot of the profile/channel analytics or branding.
              </p>
            </div>

            <ImageUpload
              value={form.image}
              onChange={(url) => setForm((f) => ({ ...f, image: url }))}
            />

            {!form.image ? (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground">
                Tip: Uploading an analytics screenshot builds trust and increases conversion.
              </div>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}