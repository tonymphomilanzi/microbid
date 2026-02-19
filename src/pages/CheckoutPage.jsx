import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
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

function statusLabel(status) {
  if (!status) return "—";
  if (status === "INITIATED") return "Awaiting payment";
  if (status === "FEE_PAID") return "Payment submitted (pending verification)";
  if (status === "FULLY_PAID") return "Verified (funded)";
  return status;
}

function statusTone(status) {
  if (status === "FEE_PAID") return "bg-yellow-500/15 text-yellow-300 border border-yellow-500/20";
  if (status === "FULLY_PAID") return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20";
  return "border-border/60 bg-muted/10 text-muted-foreground";
}

function fieldValue(fields, label) {
  const hit = (fields || []).find(
    (f) => String(f?.label || "").toLowerCase() === String(label).toLowerCase()
  );
  return hit?.value || "";
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

  // "I have paid" modal
  const [paidOpen, setPaidOpen] = useState(false);
  const [reference, setReference] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [note, setNote] = useState("");
  const [submittingPaid, setSubmittingPaid] = useState(false);

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

  const isBtc = method === "BTC";
  const btcAddress = useMemo(() => fieldValue(instructions?.fields, "BTC Address"), [instructions]);
  const btcNetwork = useMemo(() => fieldValue(instructions?.fields, "Network"), [instructions]);
  const btcQrUrl = instructions?.qrUrl || null;

  async function copy(v, label) {
    try {
      await navigator.clipboard.writeText(String(v || ""));
      toast({ title: "Copied", description: `${label} copied to clipboard.` });
    } catch {
      toast({ title: "Copy failed", description: "Please copy manually." });
    }
  }

  async function submitPaid() {
    if (!user) return openAuthModal?.();
    if (!escrow?.id) return;

    const ref = reference.trim();
    if (!ref) {
      toast({ title: "Missing reference", description: "Please enter your payment reference / transaction ID." });
      return;
    }

    setSubmittingPaid(true);
    try {
      const res = await listingsService.submitEscrowPayment({
        escrowId: escrow.id,
        reference: ref,
        proofUrl: proofUrl.trim() ? proofUrl.trim() : null,
        note: note.trim() ? note.trim() : null,
      });

      setEscrow(res.escrow);

      setPaidOpen(false);
      toast({
        title: "Payment submitted",
        description: "We received your payment details. Our team will verify and continue the transfer.",
      });

      setReference("");
      setProofUrl("");
      setNote("");
    } catch (e) {
      toast({
        title: "Could not submit payment",
        description: e?.response?.data?.message || e.message || "Try again.",
      });
    } finally {
      setSubmittingPaid(false);
    }
  }

  if (!method) {
    return (
      <PageContainer>
        <div className="py-10 space-y-2">
          <div className="text-sm font-medium">Missing payment method</div>
          <div className="text-sm text-muted-foreground">Go back to the listing and click Buy again.</div>
          <Link to={`/listings/${listingId}`} className="text-primary underline underline-offset-4">
            Back to listing
          </Link>
        </div>
      </PageContainer>
    );
  }

  const paidDisabled =
    !user || !escrow?.id || submittingPaid || escrow?.status === "FEE_PAID" || escrow?.status === "FULLY_PAID";

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
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">Order summary</div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${statusTone(escrow?.status)}`}>
                    {statusLabel(escrow?.status)}
                  </span>
                </div>

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

                    {/* ✅ BTC QR code panel (Binance-style) */}
                    {isBtc ? (
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

                        <div className="mt-4 grid gap-4 sm:grid-cols-[180px_1fr] sm:items-start">
                          <div className="overflow-hidden rounded-xl border border-border/60 bg-background">
                            {btcQrUrl ? (
                              <a href={btcQrUrl} target="_blank" rel="noreferrer" title="Open QR image">
                                <img
                                  src={btcQrUrl}
                                  alt="BTC payment QR code"
                                  className="h-[180px] w-[180px] object-cover"
                                  loading="lazy"
                                />
                              </a>
                            ) : (
                              <div className="flex h-[180px] w-[180px] items-center justify-center bg-muted/10 p-3 text-center text-xs text-muted-foreground">
                                QR not set yet.
                                <br />
                                (Admin can upload in Settings)
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 space-y-3">
                            <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-xs text-muted-foreground">BTC Address</div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-2"
                                  disabled={!btcAddress}
                                  onClick={() => copy(btcAddress, "BTC Address")}
                                >
                                  <Copy className="h-4 w-4" />
                                  Copy
                                </Button>
                              </div>
                              <div className="mt-2 font-mono text-sm font-semibold break-all">
                                {btcAddress || "—"}
                              </div>
                            </div>

                            <div className="text-xs text-muted-foreground leading-5">
                              Make sure you are sending on the correct network. Sending to the wrong network may result in loss of funds.
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {instructions.fields?.length ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {instructions.fields.map((f) => (
                          <div key={f.label} className="rounded-xl border border-border/60 bg-muted/10 p-3">
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
                        Send the <span className="font-semibold text-foreground">exact</span> total amount:{" "}
                        <span className="font-semibold text-foreground">{formatUsdFromCents(amountTotal)}</span>. Include your
                        reference code{" "}
                        <span className="font-mono font-semibold text-foreground">{refCode}</span>.
                      </div>
                    </div>

                    {/* Submit payment */}
                    {escrow?.status === "FEE_PAID" ? (
                      <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4">
                        <div className="text-sm font-medium text-yellow-200">Payment submitted</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          Your payment details were submitted. We are verifying your payment now.
                        </div>
                      </div>
                    ) : null}

                    <Button className="w-full" disabled={paidDisabled} onClick={() => setPaidOpen(true)}>
                      {escrow?.status === "FULLY_PAID"
                        ? "Payment verified"
                        : escrow?.status === "FEE_PAID"
                          ? "Payment submitted"
                          : "I have paid"}
                    </Button>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Generating instructions…</div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* I have paid dialog */}
      <Dialog open={paidOpen} onOpenChange={setPaidOpen}>
        <DialogContent className="sm:max-w-[540px] border-border/60 bg-card/80 backdrop-blur">
          <DialogHeader>
            <DialogTitle>Submit payment confirmation</DialogTitle>
            <div className="text-sm text-muted-foreground">
              Enter your transaction/reference so we can verify your payment.
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 bg-muted/10 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Reference code</span>
                <span className="font-mono font-semibold">{refCode}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-muted-foreground">Total to pay</span>
                <span className="font-semibold">{formatUsdFromCents(amountTotal)}</span>
              </div>
            </div>

            <div>
              <Label>Payment reference / Transaction ID *</Label>
              <Input
                placeholder="BTC tx hash / WU MTCN / MoMo ref / Bank transfer ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                disabled={submittingPaid}
              />
              <div className="mt-1 text-xs text-muted-foreground">
                Use the exact reference from your receipt/transaction.
              </div>
            </div>

            <div>
              <Label>Proof URL (optional)</Label>
              <Input
                placeholder="Link to receipt screenshot (optional)"
                value={proofUrl}
                onChange={(e) => setProofUrl(e.target.value)}
                disabled={submittingPaid}
              />
            </div>

            <div>
              <Label>Note (optional)</Label>
              <Textarea
                rows={3}
                placeholder="Any extra info that helps verification (sender name, amount sent, time sent...)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={submittingPaid}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="w-full" onClick={() => setPaidOpen(false)} disabled={submittingPaid}>
                Cancel
              </Button>
              <Button className="w-full" onClick={submitPaid} disabled={submittingPaid}>
                {submittingPaid ? "Submitting..." : "Submit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}