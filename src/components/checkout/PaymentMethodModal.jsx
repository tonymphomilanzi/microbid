import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";
import { listingsService } from "../../services/listings.service";
import {
  Bitcoin,
  Landmark,
  Smartphone,
  Globe,
  ArrowRight,
  Copy,
  Loader2,
} from "lucide-react";

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

function getField(fields, label) {
  const hit = (fields || []).find(
    (f) => String(f?.label || "").toLowerCase() === String(label).toLowerCase()
  );
  return hit?.value || "";
}

export default function PaymentMethodModal({ open, onOpenChange, onNext, priceUsd, listingId }) {
  const [selected, setSelected] = useState(null);

  const feeBps = 200; // 2% for now (admin-configurable later from backend)
  const feeUsd = useMemo(
    () => Math.round(((Number(priceUsd) || 0) * feeBps) / 10000),
    [priceUsd]
  );
  const totalUsd = useMemo(
    () => (Number(priceUsd) || 0) + (feeUsd || 0),
    [priceUsd, feeUsd]
  );

  // BTC preview (Binance-style)
  const [btcLoading, setBtcLoading] = useState(false);
  const [btcError, setBtcError] = useState("");
  const [btcInstructions, setBtcInstructions] = useState(null);
  const [copied, setCopied] = useState(false);

  const btcAddress = useMemo(
    () => getField(btcInstructions?.fields, "BTC Address"),
    [btcInstructions]
  );
  const btcNetwork = useMemo(
    () => getField(btcInstructions?.fields, "Network"),
    [btcInstructions]
  );
  const btcQrUrl = btcInstructions?.qrUrl || null;

  // Reset modal state when closed
  useEffect(() => {
    if (!open) {
      setSelected(null);
      setBtcLoading(false);
      setBtcError("");
      setBtcInstructions(null);
      setCopied(false);
    }
  }, [open]);

  // Load BTC instructions when BTC is selected
  useEffect(() => {
    let cancelled = false;

    async function loadBtc() {
      if (!open) return;
      if (selected !== "BTC") return;

      // Already loaded
      if (btcInstructions || btcLoading) return;

      if (!listingId) {
        setBtcError("Missing listingId. Cannot load BTC QR preview.");
        return;
      }

      setBtcError("");
      setBtcLoading(true);
      try {
        const res = await listingsService.startEscrow(listingId, "BTC");
        if (cancelled) return;

        setBtcInstructions(res?.instructions || null);
      } catch (e) {
        if (cancelled) return;
        setBtcError(e?.response?.data?.message || e?.message || "Failed to load BTC details.");
      } finally {
        if (!cancelled) setBtcLoading(false);
      }
    }

    loadBtc();
    return () => {
      cancelled = true;
    };
  }, [open, selected, listingId, btcInstructions, btcLoading]);

  async function copyToClipboard(text) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore (optional: toast)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => onOpenChange?.(v)}>
      <DialogContent className="sm:max-w-[620px] border-border/60 bg-card/80 backdrop-blur">
        <DialogHeader>
          <DialogTitle className="text-lg">Choose payment method</DialogTitle>
          <div className="text-sm text-muted-foreground">
            We hold your payment in escrow until the official channel/profile transfer is completed.
          </div>
        </DialogHeader>

        <div className="mt-2 grid gap-3">
          {/* Summary */}
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

          {/* ✅ Binance-style BTC QR section */}
          {selected === "BTC" ? (
            <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Scan to pay</div>
                  <div className="text-xs text-muted-foreground">
                    Scan the QR or copy the BTC address.
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {btcNetwork ? (
                    <Badge variant="secondary" className="rounded-full bg-muted/30">
                      {btcNetwork}
                    </Badge>
                  ) : null}
                  <Badge variant="outline" className="rounded-full border-border/60 bg-muted/10 text-muted-foreground">
                    Bitcoin
                  </Badge>
                </div>
              </div>

              {btcLoading ? (
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading BTC details…
                </div>
              ) : btcError ? (
                <div className="mt-4 text-sm text-destructive">{btcError}</div>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-[180px_1fr] sm:items-start">
                  {/* QR */}
                  <div className="overflow-hidden rounded-xl border border-border/60 bg-background">
                    {btcQrUrl ? (
                      <img
                        src={btcQrUrl}
                        alt="BTC payment QR code"
                        className="h-[180px] w-[180px] object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-[180px] w-[180px] items-center justify-center bg-muted/10 p-3 text-center text-xs text-muted-foreground">
                        QR not set yet.
                        <br />
                        (Admin can upload in Settings)
                      </div>
                    )}
                  </div>

                  {/* Address */}
                  <div className="min-w-0 space-y-3">
                    <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-muted-foreground">BTC Address</div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          disabled={!btcAddress}
                          onClick={() => copyToClipboard(btcAddress)}
                        >
                          <Copy className="h-4 w-4" />
                          {copied ? "Copied" : "Copy"}
                        </Button>
                      </div>

                      <code className="mt-2 block text-sm font-medium break-all text-foreground">
                        {btcAddress || "—"}
                      </code>
                    </div>

                    <div className="text-xs text-muted-foreground leading-5">
                      After you continue, you’ll get a reference code to include with your payment proof.
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Actions */}
          <div className="mt-2 flex items-center justify-between gap-3">
            <Button variant="outline" onClick={() => onOpenChange?.(false)} className="w-full">
              Cancel
            </Button>
            <Button onClick={() => selected && onNext?.(selected)} disabled={!selected} className="w-full">
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