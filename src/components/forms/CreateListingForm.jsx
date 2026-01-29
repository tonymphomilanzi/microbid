import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { listingsService } from "../../services/listings.service";
import ImageUpload from "./ImageUpload";

const PLATFORMS = ["YouTube", "Instagram", "TikTok", "X", "Facebook"];

export default function CreateListingForm({ initial }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState(
    initial ?? {
      id: "",
      title: "",
      platform: "YouTube",
      price: "",
      description: "",
      image: "",
      metrics: {
        followers: 0,
        avgViews: 0,
        engagementRate: 0,
        monetized: false,
      },
      status: "ACTIVE",
    }
  );

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...form,
        price: Number(form.price),
      };
      const { listing } = await listingsService.upsertListing(payload);
      navigate(`/listings/${listing.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{form.id ? "Edit Listing" : "Create Listing"}</CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <Input
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Select
                  value={form.platform}
                  onValueChange={(v) => setForm((f) => ({ ...f, platform: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Input
                placeholder="Price (USD)"
                inputMode="numeric"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                required
              />
            </div>

            <Textarea
              placeholder="Describe the asset, niche, audience, what’s included..."
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={8}
              required
            />

            {/* Metrics (stored as JSON) */}
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Followers/Subscribers"
                inputMode="numeric"
                value={form.metrics.followers}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    metrics: { ...f.metrics, followers: Number(e.target.value) },
                  }))
                }
              />
              <Input
                placeholder="Avg Views"
                inputMode="numeric"
                value={form.metrics.avgViews}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    metrics: { ...f.metrics, avgViews: Number(e.target.value) },
                  }))
                }
              />
              <Input
                placeholder="Engagement Rate %"
                inputMode="decimal"
                value={form.metrics.engagementRate}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    metrics: { ...f.metrics, engagementRate: Number(e.target.value) },
                  }))
                }
              />
              <Select
                value={String(form.metrics.monetized)}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, metrics: { ...f.metrics, monetized: v === "true" } }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Monetized?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Monetized</SelectItem>
                  <SelectItem value="false">Not monetized</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>

              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : form.id ? "Save Changes" : "Create Listing"}
              </Button>
            </div>
          </div>

          <ImageUpload value={form.image} onChange={(url) => setForm((f) => ({ ...f, image: url }))} />
        </form>
      </CardContent>
    </Card>
  );
}