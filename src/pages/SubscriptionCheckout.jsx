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
import { subscriptionsService } from "../services/subscriptions.service";
import { Copy, ArrowLeft, ShieldCheck, Crown, Sparkles, Zap, CheckCircle } from "lucide-react";
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
  if (status === "SUBMITTED") return "Payment submitted (pending verification)";
  if (status === "VERIFIED") return "Verified & Activated";
  return status;
}

function statusTone(status) {
  if (status === "SUBMITTED") return "bg-yellow-500/15 text-yellow-300 border border-yellow-500/20";
  if (status === "VERIFIED") return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20";
  return "border-border/60 bg-muted/10 text-muted-foreground";
}

function fieldValue(fields, label) {
  const hit = (fields || []).find(
    (f) => String(f?.label || "").toLowerCase() === String(label).toLowerCase()
  );
  return hit?.value || "";
}

function getPlanIcon(name) {
  if (name === "VIP") return Crown;
  if (name === "PRO") return Sparkles;
  return Zap;
}

export default function SubscriptionCheckout() {
  const { planName } = useParams();
  const [params] = useSearchParams();
  const method = (params.get("method") || "").toUpperCase();

  const { user, openAuthModal } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState(null);
  const [plan, setPlan] = useState(null);
  const [instructions, setInstructions] = useState(null);
  const [error, setError] = useState("");

  // "I have paid" modal
  const [paidOpen, setPaidOpen] = useState(false);
  const [reference, setReference] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [note, setNote] = useState("");
  const [submittingPaid, setSubmittingPaid] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function start() {
      if (!user || !planName || !method) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const res = await subscriptionsService.startPayment(planName, method);
        if (!mounted) return;

        setPayment(res.payment);
        setPlan(res.plan);
        setInstructions(res.instructions);
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || e.message || "Failed to start checkout");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    start();
    return () => (mounted = false);
  }, [user, planName, method]);

  const refCode = payment?.id || "—";
  const amountTotal = payment?.totalChargeCents;

  const isBtc = method === "BTC";
  const btcAddress = useMemo(() => fieldValue(instructions?.fields, "BTC Address"), [instructions]);
  const btcQrUrl = instructions?.qrUrl || null;

  const PlanIcon = getPlanIcon(plan?.name);

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
    if (!payment?.id) return;

    const ref = reference.trim();
    if (!ref) {
      toast({ title: "Missing reference", description: "Please enter your payment reference / transaction ID." });
      return;
    }

    setSubmittingPaid(true);
    try {
      const res = await subscriptionsService.submitPayment({
        paymentId: payment.id,
        reference: ref,
        proofUrl: proofUrl.trim() || null,
        note: note.trim() || null,
      });

      setPayment(res.payment);
      setPaidOpen(false);
      toast({
        title: "Payment submitted",
        description: "We received your payment details. Your plan will be activated after verification.",
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
          <div className="text-sm text-muted-foreground">Go back to pricing and select a plan.</div>
          <Link to="/pricing" className="text-primary underline underline-offset-4">
            Back to pricing
          </Link>
        </div>
      </PageContainer>
    );
  }

  const paidDisabled =
    !user || !payment?.id || submittingPaid || payment?.status === "SUBMITTED" || payment?.status === "VERIFIED";

  return (
    <PageContainer>
      <div className="py-8 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Link to="/pricing">
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
                  <div className="text-sm font-semibold">Subscription</div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${statusTone(payment?.status)}`}>
                    {statusLabel(payment?.status)}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
                    <PlanIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold">{plan?.name} Plan</div>
                    <div className="text-xs text-muted-foreground">{plan?.billingType}</div>
                  </div>
                </div>

                <Separator className="bg-border/60" />

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total to pay</span>
                    <span className="text-base font-semibold">{formatUsdFromCents(amountTotal)}</span>
                  </div>
                </div>

                <div className="mt-2 rounded-xl border border-border/60 bg-muted/10 p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Manual verification
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Your plan activates after our team verifies payment.
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
                      disabled={!payment?.id}
                    >
                      <Copy className="h-4 w-4" />
                      Copy
                    </Button>
                  </div>
                </div>

                <Separator className="bg-border/60" />

                {payment?.status === "VERIFIED" ? (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-400" />
                      <div className="font-semibold text-emerald-400">Plan activated!</div>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Your {plan?.name} plan is now active. Enjoy your upgraded features!
                    </div>
                    <Link to="/dashboard">
                      <Button className="mt-3">Go to Dashboard</Button>
                    </Link>
                  </div>
                ) : !user ? (
                  <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
                    <div className="text-sm font-medium">Login required</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Please login to generate your payment reference and continue.
                    </div>
                    <Button onClick={openAuthModal} className="mt-3">
                      Login
                    </Button>
                  </div>
                ) : instructions ? (
                  <div className="space-y-3">
                    {instructions.lines?.map((line, idx) => (
                      <div key={idx} className="text-sm text-muted-foreground leading-6">
                        • {line}
                      </div>
                    ))}

                    {/* BTC QR code panel */}
                    {isBtc ? (
                      <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">Scan to pay</div>
                            <div className="text-xs text-muted-foreground">
                              Scan the QR or copy the BTC address.
                            </div>
                          </div>
                          <Badge variant="outline" className="rounded-full border-border/60 bg-muted/10 text-muted-foreground">
                            Bitcoin
                          </Badge>
                        </div>

                        <div className="mt-4 grid gap-4 sm:grid-cols-[180px_1fr] sm:items-start">
                          <div className="overflow-hidden rounded-xl border border-border/60 bg-background">
                            {btcQrUrl ? (
                              <img
                                src={btcQrUrl}
                                alt="BTC payment QR code"
                                className="h-[180px] w-[180px] object-cover"
                              />
                            ) : (
                              <div className="flex h-[180px] w-[180px] items-center justify-center bg-muted/10 p-3 text-center text-xs text-muted-foreground">
                                QR not configured.
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
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {instructions.fields?.length && !isBtc ? (
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
                        reference code <span className="font-mono font-semibold text-foreground">{refCode}</span>.
                      </div>
                    </div>

                    {payment?.status === "SUBMITTED" ? (
                      <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4">
                        <div className="text-sm font-medium text-yellow-200">Payment submitted</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          We are verifying your payment. Your plan will be activated shortly.
                        </div>
                      </div>
                    ) : null}

                    <Button className="w-full" disabled={paidDisabled} onClick={() => setPaidOpen(true)}>
                      {payment?.status === "VERIFIED"
                        ? "Plan activated"
                        : payment?.status === "SUBMITTED"
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
                placeholder="Any extra info that helps verification..."
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