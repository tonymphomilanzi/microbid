import { useEffect, useMemo, useState } from "react";
import PageContainer from "../components/layout/PageContainer";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { listingsService } from "../services/listings.service";
import { useAuth } from "../context/AuthContext";
import { Check, Crown, Sparkles } from "lucide-react";

function money(cents) {
  const v = (Number(cents || 0) / 100).toFixed(2);
  return `$${v}`;
}

function featuresList(plan) {
  const f = plan?.features || {};
  return [
    { label: "Listings / month", value: f.listingsPerMonth ?? "—" },
    { label: "New conversations / month", value: f.conversationsPerMonth ?? "—" },
  ];
}

function PlanCard({ plan, isCurrent, onSelect, loading }) {
  const isPro = plan.name === "PRO";
  const isVip = plan.name === "VIP";

  const borderGlow = plan.highlight
    ? "from-primary/60 via-primary/10 to-primary/40"
    : "from-border/60 via-transparent to-border/60";

  const icon = isVip ? Crown : isPro ? Sparkles : Check;

  const priceLine =
    plan.billingType === "FREE"
      ? "Free"
      : plan.billingType === "MONTHLY"
      ? `${money(plan.monthlyPriceCents)}/month`
      : `${money(plan.oneTimePriceCents)} lifetime`;

  const items = featuresList(plan);

  return (
    <div className="relative">
      {/* NFT-style gradient border */}
      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${borderGlow} opacity-70 blur-[10px]`} />
      <Card className="relative rounded-2xl border-border/60 bg-card/60 backdrop-blur">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold tracking-tight">{plan.name}</span>
                {plan.highlight ? (
                  <Badge className="bg-primary text-primary-foreground">Recommended</Badge>
                ) : null}
                {isCurrent ? <Badge variant="outline">Current</Badge> : null}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{plan.tagline || "—"}</div>
            </div>

            <div className="h-10 w-10 rounded-xl border border-border/60 bg-muted/20 grid place-items-center">
              {(() => {
                const Icon = icon;
                return <Icon className="h-5 w-5 text-primary" />;
              })()}
            </div>
          </div>

          <div className="text-3xl font-semibold">{priceLine}</div>

          <div className="space-y-2">
            {items.map((x) => (
              <div key={x.label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{x.label}</span>
                <span className="font-semibold">{x.value}</span>
              </div>
            ))}
          </div>

          <Button
            className="w-full"
            variant={isCurrent ? "outline" : "default"}
            onClick={onSelect}
            disabled={loading || isCurrent || plan.name === "FREE"}
          >
            {isCurrent ? "Current plan" : plan.name === "FREE" ? "Free plan" : "Request upgrade"}
          </Button>

          <div className="text-xs text-muted-foreground">
            Manual upgrade for now. Admin will review your request.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Pricing() {
  const { user, openAuthModal, me } = useAuth();

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  const [actionLoading, setActionLoading] = useState("");
  const [message, setMessage] = useState("");

  const currentTier = me?.tier || "FREE";

  useEffect(() => {
    let mounted = true;

    async function run() {
      setLoading(true);
      try {
        const { plans } = await listingsService.getPlansPublic();
        if (!mounted) return;
        setPlans(plans || []);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    run();
    return () => (mounted = false);
  }, []);

  const sortedPlans = useMemo(() => {
    return [...plans].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [plans]);

  async function requestUpgrade(planName) {
    setMessage("");

    if (!user) {
      openAuthModal();
      return;
    }

    setActionLoading(planName);
    try {
      await listingsService.requestUpgrade(planName);
      setMessage(`Upgrade request submitted for ${planName}.`);
    } catch (e) {
      setMessage(e?.response?.data?.message || e.message || "Failed to request upgrade");
    } finally {
      setActionLoading("");
    }
  }

  return (
    <PageContainer>
      <div className="py-10 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Plans</h1>
          <p className="text-sm text-muted-foreground">
            Upgrade your account to increase monthly limits and unlock discounts. VIP is lifetime.
          </p>
          {message ? (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm">
              {message}
            </div>
          ) : null}
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading plans…</div>
          ) : (
            sortedPlans.map((p) => (
              <PlanCard
                key={p.id}
                plan={p}
                isCurrent={p.name === currentTier}
                loading={actionLoading === p.name}
                onSelect={() => requestUpgrade(p.name)}
              />
            ))
          )}
        </div>
      </div>
    </PageContainer>
  );
}