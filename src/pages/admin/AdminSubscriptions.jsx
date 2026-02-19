import { useEffect, useState } from "react";
import { adminService } from "../../services/admin.service";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Switch } from "../../components/ui/switch";
import { Badge } from "../../components/ui/badge";

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function AdminSubscriptions() {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [savingId, setSavingId] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await adminService.getPlans();
      setPlans(res.plans || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateLocal(planId, patch) {
    setPlans((prev) =>
      prev.map((p) => (p.id === planId ? { ...p, ...patch } : p))
    );
  }

  async function save(plan) {
    setSavingId(plan.id);
    try {
      await adminService.updatePlan(plan.id, {
        isActive: plan.isActive,
        order: num(plan.order, 0),
        highlight: !!plan.highlight,
        tagline: plan.tagline ?? "",
        features: {
          listingsPerMonth: num(plan.features?.listingsPerMonth, 0),
          conversationsPerMonth: num(plan.features?.conversationsPerMonth, 0),
        },
      });
      await load();
    } finally {
      setSavingId("");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Subscriptions</h1>
        <p className="text-sm text-muted-foreground">
          Edit plan limits (listings/month + new conversations/month). Use -1 for unlimited.
        </p>
      </div>

      {loading ? (
        <Card className="border-border/60 bg-card/60">
          <CardContent className="p-6 text-sm text-muted-foreground">Loading plans…</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {plans.map((p) => (
            <Card key={p.id} className="border-border/60 bg-card/60">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.billingType}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="outline">ID: {p.id}</Badge>
                      {p.highlight ? <Badge>Highlighted</Badge> : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                    <span className="text-sm text-muted-foreground">Active</span>
                    <Switch
                      checked={!!p.isActive}
                      onCheckedChange={(v) => updateLocal(p.id, { isActive: v })}
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Listings / month</div>
                    <Input
                      value={String(p.features?.listingsPerMonth ?? 0)}
                      onChange={(e) =>
                        updateLocal(p.id, {
                          features: {
                            ...(p.features || {}),
                            listingsPerMonth: e.target.value,
                          },
                        })
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">New conversations / month</div>
                    <Input
                      value={String(p.features?.conversationsPerMonth ?? 0)}
                      onChange={(e) =>
                        updateLocal(p.id, {
                          features: {
                            ...(p.features || {}),
                            conversationsPerMonth: e.target.value,
                          },
                        })
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Order</div>
                    <Input
                      value={String(p.order ?? 0)}
                      onChange={(e) => updateLocal(p.id, { order: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Tagline</div>
                    <Input
                      value={p.tagline ?? ""}
                      onChange={(e) => updateLocal(p.id, { tagline: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Highlight</span>
                    <Switch
                      checked={!!p.highlight}
                      onCheckedChange={(v) => updateLocal(p.id, { highlight: v })}
                    />
                  </div>

                  <Button onClick={() => save(p)} disabled={savingId === p.id}>
                    {savingId === p.id ? "Saving…" : "Save"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}