import { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";
import { Bitcoin, Landmark, Smartphone, Globe, ArrowRight, Crown, Sparkles, Zap } from "lucide-react";

const METHODS = [
  {
    key: "BTC",
    label: "Bitcoin",
    desc: "Pay using BTC. Fast global settlement.",
    icon: Bitcoin,
    badge: "Crypto",
  },
  {
    key: "WU",
    label: "Western Union",
    desc: "Pay via agent transfer (WU).",
    icon: Globe,
    badge: "Cash transfer",
  },
  {
    key: "MOMO",
    label: "Mobile Money",
    desc: "Pay with MoMo (MTN/Airtel etc).",
    icon: Smartphone,
    badge: "Mobile",
  },
  {
    key: "BANK",
    label: "Bank Transfer",
    desc: "Pay via bank account transfer/wire.",
    icon: Landmark,
    badge: "Bank",
  },
];

function money(cents) {
  const v = (Number(cents || 0) / 100).toFixed(2);
  return `$${v}`;
}

function getPlanIcon(name) {
  if (name === "VIP") return Crown;
  if (name === "PRO") return Sparkles;
  return Zap;
}

export default function SubscriptionPaymentModal({ open, onOpenChange, plan, onNext }) {
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!open) setSelected(null);
  }, [open]);

  const priceLabel = useMemo(() => {
    if (!plan) return "$0";
    if (plan.billingType === "MONTHLY") return money(plan.monthlyPriceCents);
    if (plan.billingType === "LIFETIME") return money(plan.oneTimePriceCents);
    return "$0";
  }, [plan]);

  const billingLabel = useMemo(() => {
    if (!plan) return "";
    if (plan.billingType === "MONTHLY") return "/month";
    if (plan.billingType === "LIFETIME") return " (lifetime)";
    return "";
  }, [plan]);

  const PlanIcon = getPlanIcon(plan?.name);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] border-border/60 bg-card/80 backdrop-blur">
        <DialogHeader>
          <DialogTitle className="text-lg">Subscribe to {plan?.name}</DialogTitle>
          <div className="text-sm text-muted-foreground">
            Choose your payment method to upgrade your account.
          </div>
        </DialogHeader>

        <div className="mt-2 grid gap-3">
          {/* Plan Summary */}
          <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
                  <PlanIcon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="font-semibold">{plan?.name} Plan</div>
                  <div className="text-sm text-muted-foreground">{plan?.tagline || "Upgrade your account"}</div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-2xl font-semibold">{priceLabel}</div>
                <div className="text-sm text-muted-foreground">{billingLabel}</div>
              </div>
            </div>

            {plan?.features ? (
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Listings/month: </span>
                  <span className="font-semibold">
                    {plan.features.listingsPerMonth < 0 ? "Unlimited" : plan.features.listingsPerMonth}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Conversations/month: </span>
                  <span className="font-semibold">
                    {plan.features.conversationsPerMonth < 0 ? "Unlimited" : plan.features.conversationsPerMonth}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {/* Methods */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {METHODS.map((m) => {
              const Icon = m.icon;
              const active = selected === m.key;

              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setSelected(m.key)}
                  className={cn(
                    "group rounded-2xl border p-4 text-left transition",
                    "border-border/60 bg-background/40 hover:bg-muted/10",
                    active && "border-primary/40 ring-2 ring-primary/20 bg-primary/5"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl border",
                          active ? "border-primary/30 bg-primary/10" : "border-border/60 bg-muted/10"
                        )}
                      >
                        <Icon className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} />
                      </div>
                      <div>
                        <div className="font-semibold">{m.label}</div>
                        <div className="text-xs text-muted-foreground">{m.desc}</div>
                      </div>
                    </div>

                    <Badge variant="outline" className="border-border/60 bg-muted/10 text-muted-foreground">
                      {m.badge}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="mt-2 flex items-center justify-between gap-3">
            <Button variant="outline" onClick={() => onOpenChange?.(false)} className="w-full">
              Cancel
            </Button>
            <Button onClick={() => selected && onNext?.(selected)} disabled={!selected} className="w-full">
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            After payment is verified by our team, your plan will be activated immediately.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}