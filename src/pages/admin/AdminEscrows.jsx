// src/pages/admin/AdminEscrows.jsx
// -----------------------------------------------------------------------------
// Mobile-responsive Escrows queue + Drawer with full scrollable content
// - List escrows (default: FEE_PAID)
// - Tap row -> opens Drawer
// - Drawer has its own scroll area + sticky bottom action bar (Verify / Close)
// -----------------------------------------------------------------------------

import { useEffect, useMemo, useState } from "react";
import { adminService } from "../../services/admin.service";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Separator } from "../../components/ui/separator";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "../../components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { Copy, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import { useToast } from "../../hooks/use-toast";

function fmtUsdFromCents(cents) {
  if (cents == null) return "—";
  const n = Number(cents);
  if (!Number.isFinite(n)) return "—";
  return `$${(n / 100).toFixed(2)}`;
}

function statusBadgeClass(status) {
  if (status === "FEE_PAID") return "bg-yellow-500/15 text-yellow-300 border border-yellow-500/20";
  if (status === "FULLY_PAID") return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20";
  if (status === "INITIATED") return "bg-zinc-500/10 text-zinc-300 border-zinc-500/20";
  if (status === "DISPUTED") return "bg-destructive/10 text-destructive border-destructive/20";
  return "border-border/60 bg-muted/20 text-muted-foreground";
}

function providerLabel(provider, providerRef) {
  if (provider === "BTC") return "Bitcoin";
  if (provider === "MOMO") return "Mobile Money";
  if (provider === "MANUAL" && providerRef === "WU") return "Western Union";
  if (provider === "MANUAL" && providerRef === "BANK") return "Bank Transfer";
  return providerRef ? `${provider} (${providerRef})` : provider;
}

function ProofCard({ proof, onCopy }) {
  const hasUrl = Boolean(proof?.url);

  return (
    <div className="rounded-xl border border-border/60 bg-muted/10 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="outline" className="border-border/60 bg-muted/20">
          {proof.kind}
        </Badge>
        <div className="text-xs text-muted-foreground">
          {proof.createdAt ? new Date(proof.createdAt).toLocaleString() : ""}
        </div>
      </div>

      {proof.note ? (
        <div>
          <div className="text-xs text-muted-foreground">Reference / Note</div>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="font-mono text-sm font-semibold break-all">{proof.note}</div>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => onCopy(proof.note, "Reference")}>
              <Copy className="h-4 w-4" />
              Copy
            </Button>
          </div>
        </div>
      ) : null}

      {hasUrl ? (
        <div>
          <div className="text-xs text-muted-foreground">Proof URL</div>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground break-all">{proof.url}</div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm" className="gap-2">
                <a href={proof.url} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Open
                </a>
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => onCopy(proof.url, "Proof URL")}>
                <Copy className="h-4 w-4" />
                Copy
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AdminEscrows() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [escrows, setEscrows] = useState([]);
  const [error, setError] = useState("");

  // filters
  const [status, setStatus] = useState("FEE_PAID");
  const [q, setQ] = useState("");

  // drawer state
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const selected = useMemo(() => escrows.find((e) => e.id === selectedId) || null, [escrows, selectedId]);

  // verify confirm
  const [confirmVerifyOpen, setConfirmVerifyOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);

  async function copy(val, label) {
    try {
      await navigator.clipboard.writeText(String(val || ""));
      toast({ title: "Copied", description: `${label} copied.` });
    } catch {
      toast({ title: "Copy failed", description: "Copy manually." });
    }
  }

  async function load() {
    setError("");
    setLoading(true);
    try {
      const { escrows } = await adminService.getEscrows({
        ...(status ? { status } : {}),
        ...(q.trim() ? { q: q.trim() } : {}),
      });
      setEscrows(escrows ?? []);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to load escrows");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const counts = useMemo(() => {
    const total = escrows.length;
    const feePaid = escrows.filter((e) => e.status === "FEE_PAID").length;
    const fullyPaid = escrows.filter((e) => e.status === "FULLY_PAID").length;
    return { total, feePaid, fullyPaid };
  }, [escrows]);

  const canVerify = Boolean(selected && ["FEE_PAID", "FULLY_PAID"].includes(selected.status));

  async function verifySelected() {
    if (!selected?.id) return;

    setVerifying(true);
    try {
      await adminService.verifyEscrowPayment(selected.id);

      toast({ title: "Verified", description: "Escrow marked as verified and listing set to SOLD." });

      setConfirmVerifyOpen(false);
      setOpen(false);
      setSelectedId("");

      await load();
    } catch (e) {
      toast({
        title: "Verify failed",
        description: e?.response?.data?.message || e.message || "Try again.",
      });
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Escrows</h1>
        <p className="text-sm text-muted-foreground">
          Review payment proofs and verify manual payments. Default view shows{" "}
          <span className="font-medium">FEE_PAID</span>.
        </p>
      </div>

      {error ? (
        <Card className="border-border/60 bg-card/60">
          <CardContent className="p-5 text-sm">
            <div className="font-medium">Error</div>
            <div className="mt-1 text-muted-foreground">{error}</div>
            <div className="mt-4">
              <Button variant="outline" onClick={load}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Filters */}
      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-border/60 bg-muted/20">
                Total: {counts.total}
              </Badge>
              <Badge className="bg-yellow-500/15 text-yellow-300 border border-yellow-500/20">
                FEE_PAID: {counts.feePaid}
              </Badge>
              <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                FULLY_PAID: {counts.fullyPaid}
              </Badge>
            </div>

            <Button variant="outline" className="gap-2" onClick={load} disabled={loading}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-1">
              <div className="text-xs text-muted-foreground mb-1">Status</div>
              <select
                className="h-10 w-full rounded-md border border-border/60 bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="FEE_PAID">FEE_PAID (verify)</option>
                <option value="INITIATED">INITIATED</option>
                <option value="FULLY_PAID">FULLY_PAID</option>
                <option value="">All</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <div className="text-xs text-muted-foreground mb-1">Search</div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Search by escrow id, listing title, buyerId, sellerId..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") load();
                  }}
                />
                <Button onClick={load} disabled={loading} className="sm:w-auto w-full">
                  Search
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-0">
          <div className="divide-y divide-border/60">
            {loading ? (
              <div className="p-6 text-sm text-muted-foreground">Loading escrows…</div>
            ) : escrows.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No escrows found.</div>
            ) : (
              escrows.map((e) => {
                const label = providerLabel(e.provider, e.providerRef);

                return (
                  <button
                    key={e.id}
                    type="button"
                    className="w-full text-left p-4 hover:bg-muted/20 transition"
                    onClick={() => {
                      setSelectedId(e.id);
                      setOpen(true);
                    }}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium truncate">{e.listing?.title || "—"}</div>

                          <Badge variant="outline" className={statusBadgeClass(e.status)}>
                            {e.status}
                          </Badge>

                          <Badge variant="outline" className="border-border/60 bg-muted/20">
                            {label}
                          </Badge>

                          {typeof e.listing?.price === "number" ? (
                            <Badge variant="outline" className="border-border/60 bg-muted/20">
                              Price ${e.listing.price}
                            </Badge>
                          ) : null}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          Escrow: <span className="font-mono break-all">{e.id}</span>
                        </div>

                        <div className="text-xs text-muted-foreground">
                          Buyer: <span className="font-mono break-all">{e.buyerId}</span> • Seller:{" "}
                          <span className="font-mono break-all">{e.sellerId}</span>
                        </div>

                        <div className="text-xs text-muted-foreground">
                          Created: {e.createdAt ? new Date(e.createdAt).toLocaleString() : ""}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <Badge variant="outline" className="border-border/60 bg-muted/20">
                          Total {fmtUsdFromCents(e.totalChargeCents)}
                        </Badge>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={(ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            copy(e.id, "Escrow ID");
                          }}
                        >
                          <Copy className="h-4 w-4" />
                          Copy ID
                        </Button>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Drawer (scrollable + sticky footer actions) */}
      <Drawer
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setSelectedId("");
        }}
      >
        {/* fixed height on mobile, smaller on desktop; prevent clipping */}
        <DrawerContent className="h-[92vh] sm:h-[85vh] overflow-hidden">
          {/* this wrapper scrolls */}
          <div className="mx-auto h-full w-full max-w-3xl overflow-y-auto px-4 pb-28">
            <DrawerHeader className="px-0">
              <DrawerTitle>Escrow details</DrawerTitle>
              <div className="text-xs text-muted-foreground">
                Review proofs and verify the payment if correct.
              </div>
            </DrawerHeader>

            {!selected ? (
              <div className="p-6 text-sm text-muted-foreground">Loading details…</div>
            ) : (
              <div className="space-y-4">
                {/* Summary */}
                <Card className="border-border/60 bg-card/60">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{selected.listing?.title || "—"}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Escrow ID: <span className="font-mono break-all">{selected.id}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={statusBadgeClass(selected.status)}>
                          {selected.status}
                        </Badge>
                        <Badge variant="outline" className="border-border/60 bg-muted/20">
                          {providerLabel(selected.provider, selected.providerRef)}
                        </Badge>
                      </div>
                    </div>

                    <Separator className="bg-border/60" />

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
                        <div className="text-xs text-muted-foreground">Price</div>
                        <div className="text-sm font-semibold">{fmtUsdFromCents(selected.priceCents)}</div>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
                        <div className="text-xs text-muted-foreground">Fee</div>
                        <div className="text-sm font-semibold">
                          {fmtUsdFromCents(selected.feeCents)}{" "}
                          <span className="text-xs text-muted-foreground">({selected.feeBps} bps)</span>
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
                        <div className="text-xs text-muted-foreground">Total</div>
                        <div className="text-sm font-semibold">{fmtUsdFromCents(selected.totalChargeCents)}</div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
                        <div className="text-xs text-muted-foreground">Buyer</div>
                        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="font-mono text-xs break-all">{selected.buyerId}</div>
                          <Button variant="outline" size="sm" className="gap-2" onClick={() => copy(selected.buyerId, "Buyer ID")}>
                            <Copy className="h-4 w-4" />
                            Copy
                          </Button>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
                        <div className="text-xs text-muted-foreground">Seller</div>
                        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="font-mono text-xs break-all">{selected.sellerId}</div>
                          <Button variant="outline" size="sm" className="gap-2" onClick={() => copy(selected.sellerId, "Seller ID")}>
                            <Copy className="h-4 w-4" />
                            Copy
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
                      <div className="text-xs text-muted-foreground">Listing</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-border/60 bg-muted/20">
                          {selected.listing?.platform || "—"}
                        </Badge>
                        <Badge variant="outline" className="border-border/60 bg-muted/20">
                          Listing status: {selected.listing?.status || "—"}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => copy(selected.listing?.id, "Listing ID")}
                          disabled={!selected.listing?.id}
                        >
                          <Copy className="h-4 w-4" />
                          Copy listing ID
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Proofs */}
                <Card className="border-border/60 bg-card/60">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">Proofs</div>
                      <Badge variant="outline" className="border-border/60 bg-muted/20">
                        {(selected.proofs?.length ?? 0)} total
                      </Badge>
                    </div>

                    {selected.proofs?.length ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {selected.proofs.map((p) => (
                          <ProofCard key={p.id} proof={p} onCopy={copy} />
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">No proofs uploaded/submitted yet.</div>
                    )}
                  </CardContent>
                </Card>

                {/* Verification info */}
                <Card className="border-border/60 bg-card/60">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      Verification
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Verify only after confirming the payment matches incoming funds. This will set listing to SOLD and
                      create a Purchase record (if missing).
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Sticky bottom actions (always visible on mobile) */}
            <div className="sticky bottom-0 left-0 right-0 -mx-4 mt-6 border-t border-border/60 bg-background/80 backdrop-blur px-4 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  className="w-full sm:w-auto"
                  disabled={!canVerify || verifying || !selected}
                  onClick={() => setConfirmVerifyOpen(true)}
                >
                  {verifying ? "Verifying..." : "Mark payment verified"}
                </Button>

                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setOpen(false)}
                  disabled={verifying}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Verify confirm dialog */}
      <AlertDialog open={confirmVerifyOpen} onOpenChange={setConfirmVerifyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Verify this payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will:
              <div className="mt-2 text-sm">
                • Set escrow to <span className="font-semibold">FULLY_PAID</span> and set fundedAt
                <br />
                • Create a <span className="font-semibold">Purchase</span> record (if missing)
                <br />
                • Set listing status to <span className="font-semibold">SOLD</span>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Escrow: <span className="font-mono break-all">{selected?.id}</span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={verifying}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={verifying} onClick={verifySelected}>
              {verifying ? "Verifying..." : "Yes, verify"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}