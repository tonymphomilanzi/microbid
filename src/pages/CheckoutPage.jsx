import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { useAuth } from "../context/AuthContext";
import { listingsService } from "../services/listings.service";
import { Copy, ArrowLeft, ShieldCheck } from "lucide-react";
import { useToast } from "../hooks/use-toast";

function formatUsdFromCents(cents) {
  if (cents == null) return "—";
  return `$${(Number(cents) / 100).toFixed(2)}`;
}

function methodLabel(method) {
  if (method === "BTC") return "Bitcoin";
  if (method === "WU") return "Western Union";
  if (method === "MOMO") return "Mobile Money";
  if (method === "BANK") return "Bank Transfer";
  return method || "Payment";
}

export default function CheckoutPage() {
  const { listingId } = useParams();
  const [params] = useSearchParams();
  const method = (params.get("method") || "").toUpperCase();

  const { user, openAuthModal } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState(null);
  const [escrow, setEscrow] = useState(null);
  const [instructions, setInstructions] = useState(null);
  const [error, setError] = useState("");

  const canStart = Boolean(user && listingId && method);

  useEffect(() => {
    let mounted = true;

    async function run() {
      setLoading(true);
      setError("");

      try {
        const { listing } = await listingsService.getListing(listingId);
        if (!mounted) return;
        setListing(listing);
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || e.message || "Failed to load listing");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (listingId) run();
    return () => (mounted = false);
  }, [listingId]);

  useEffect(() => {
    let mounted = true;

    async function start() {
      if (!canStart) return;
      try {
        const res = await listingsService.startEscrow(listingId, method);
        if (!mounted) return;
        setEscrow(res.escrow);
        setInstructions(res.instructions);
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || e.message || "Failed to start checkout");
      }
    }

    start();
    return () => (mounted = false);
  }, [canStart, listingId, method]);

  const title = listing?.title || "Checkout";
  const refCode = escrow?.id || "—";

  const amountPrice = useMemo(() => escrow?.priceCents, [escrow]);
  const amountFee = useMemo(() => escrow?.feeCents, [escrow]);
  const amountTotal = useMemo(() => escrow?.totalChargeCents, [escrow]);

  async function copy(v, label) {
    try {
      await navigator.clipboard.writeText(String(v || ""));
      toast({ title: "Copied", description: `${label} copied to clipboard.` });
    } catch {
      toast({ title: "Copy failed", description: "Please copy manually." });
    }
  }

  if (!method) {
    return (
      <PageContainer>
        <div className="py-10 space-y-2">
          <div className="text-sm font-medium">Missing payment method</div>
          <div className="text-sm text-muted-foreground">
            Go back to the listing and click Buy again.
          </div>
          <Link to={`/listings/${listingId}`} className="text-primary underline underline-offset-4">
            Back to listing
          </Link>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="py-8 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Link to={`/listings/${listingId}`}>
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>

          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
            {methodLabel(method)}
          </Badge>
        </div>

        {loading ? (
          <div className="py-10 text-sm text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="py-10 space-y-2">
            <div className="text-sm font-medium">Checkout error</div>
            <div className="text-sm text-destructive">{error}</div>
            {!user ? (
              <Button onClick={openAuthModal} className="mt-2">
                Login to continue
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Summary */}
            <Card className="border-border/60 bg-card/60 lg:col-span-1">
              <CardContent className="p-5 space-y-3">
                <div className="text-sm font-semibold">Order summary</div>
                <div className="text-sm text-muted-foreground line-clamp-3">{title}</div>

                <Separator className="bg-border/60" />

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Price</span>
                    <span className="font-semibold">{formatUsdFromCents(amountPrice)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Escrow fee</span>
                    <span className="font-semibold">{formatUsdFromCents(amountFee)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total to pay</span>
                    <span className="text-base font-semibold">{formatUsdFromCents(amountTotal)}</span>
                  </div>
                </div>

                <div className="mt-2 rounded-xl border border-border/60 bg-muted/10 p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Escrow protected
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    We hold funds until the official channel/profile transfer is completed.
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Instructions */}
            <Card className="border-border/60 bg-card/60 lg:col-span-2">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Payment instructions</div>
                    <div className="text-xs text-muted-foreground">
                      Use the details below and include your reference code.
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Reference code</div>
                    <div className="font-mono text-sm font-semibold">{refCode}</div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 gap-2"
                      onClick={() => copy(refCode, "Reference code")}
                      disabled={!escrow?.id}
                    >
                      <Copy className="h-4 w-4" />
                      Copy
                    </Button>
                  </div>
                </div>

                <Separator className="bg-border/60" />

                {!user ? (
                  <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
                    <div className="text-sm font-medium">Login required</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Please login to generate your escrow reference and continue.
                    </div>
                    <Button onClick={openAuthModal} className="mt-3">
                      Login
                    </Button>
                  </div>
                ) : null}

                {instructions ? (
                  <div className="space-y-3">
                    {instructions.lines?.map((line, idx) => (
                      <div key={idx} className="text-sm text-muted-foreground leading-6">
                        • {line}
                      </div>
                    ))}

                    {instructions.fields?.length ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {instructions.fields.map((f) => (
                          <div
                            key={f.label}
                            className="rounded-xl border border-border/60 bg-muted/10 p-3"
                          >
                            <div className="text-xs text-muted-foreground">{f.label}</div>
                            <div className="mt-1 flex items-center justify-between gap-2">
                              <div className="font-mono text-sm font-semibold break-all">{f.value}</div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => copy(f.value, f.label)}
                              >
                                <Copy className="h-4 w-4" />
                                Copy
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
                      <div className="text-sm font-medium">Important</div>
                      <div className="mt-1 text-sm text-muted-foreground leading-6">
                        Send the <span className="font-semibold text-foreground">exact</span> total amount:
                        {" "}
                        <span className="font-semibold text-foreground">{formatUsdFromCents(amountTotal)}</span>.
                        Include your reference code <span className="font-mono font-semibold text-foreground">{refCode}</span>.
                      </div>
                    </div>

                    {/* Later you can add proof upload + status tracking */}
                    <Button className="w-full" disabled>
                      I have paid (coming soon)
                    </Button>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Generating instructions…
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PageContainer>
  );
}