import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils"; // if you don't have cn(), remove cn usage and join strings manually
import { Bitcoin, Landmark, Smartphone, Globe, ArrowRight } from "lucide-react";

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

export default function PaymentMethodModal({ open, onOpenChange, onNext, priceUsd }) {
  const [selected, setSelected] = useState(null);

  const feeBps = 200; // 2% for now (admin-configurable later from backend)
  const feeUsd = useMemo(() => Math.round(((Number(priceUsd) || 0) * feeBps) / 10000), [priceUsd]);
  const totalUsd = useMemo(() => (Number(priceUsd) || 0) + (feeUsd || 0), [priceUsd, feeUsd]);

  return (
    <Dialog open={open} onOpenChange={(v) => onOpenChange?.(v)}>
      <DialogContent className="sm:max-w-[560px] border-border/60 bg-card/80 backdrop-blur">
        <DialogHeader>
          <DialogTitle className="text-lg">Choose payment method</DialogTitle>
          <div className="text-sm text-muted-foreground">
            We hold your payment in escrow until the official channel/profile transfer is completed.
          </div>
        </DialogHeader>

        <div className="mt-2 grid gap-3">
          <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Listing price</div>
              <div className="font-semibold">${Number(priceUsd || 0)}</div>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Escrow fee (2%)</div>
              <div className="font-semibold">${feeUsd}</div>
            </div>
            <div className="mt-2 h-px bg-border/60" />
            <div className="mt-2 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Total to pay</div>
              <div className="text-base font-semibold">${totalUsd}</div>
            </div>
          </div>

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

          <div className="mt-2 flex items-center justify-between gap-3">
            <Button variant="outline" onClick={() => onOpenChange?.(false)} className="w-full">
              Cancel
            </Button>
            <Button
              onClick={() => selected && onNext?.(selected)}
              disabled={!selected}
              className="w-full"
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            By continuing, you agree to pay the total amount shown and include your reference code during payment.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}