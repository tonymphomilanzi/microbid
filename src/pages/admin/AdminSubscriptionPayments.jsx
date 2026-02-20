import { useEffect, useState } from "react";
import { adminService } from "../../services/admin.service";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";

function formatUsd(cents) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function statusBadge(status) {
  if (status === "VERIFIED") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (status === "SUBMITTED") return "bg-yellow-500/15 text-yellow-300 border-yellow-500/30";
  if (status === "INITIATED") return "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";
  return "";
}

export default function AdminSubscriptionPayments() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("SUBMITTED");
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [verifying, setVerifying] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await adminService.getSubscriptionPayments({ q: q || undefined, status: status || undefined });
      setPayments(res.payments || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function verify(id) {
    setVerifying(id);
    try {
      await adminService.verifySubscriptionPayment(id);
      await load();
    } finally {
      setVerifying("");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Subscription Payments</h1>
        <p className="text-sm text-muted-foreground">Verify subscription payments and activate user plans.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search by ID, user, reference..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Button variant="outline" onClick={load}>Search</Button>

        <div className="flex gap-1">
          {["", "INITIATED", "SUBMITTED", "VERIFIED"].map((s) => (
            <Button
              key={s}
              variant={status === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatus(s)}
            >
              {s || "All"}
            </Button>
          ))}
        </div>
      </div>

      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-0">
          <div className="divide-y divide-border/60">
            {loading ? (
              <div className="p-6 text-sm text-muted-foreground">Loading…</div>
            ) : payments.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No payments found.</div>
            ) : (
              payments.map((p) => (
                <div key={p.id} className="p-4 space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{p.plan?.name} Plan</span>
                        <Badge variant="outline" className={statusBadge(p.status)}>{p.status}</Badge>
                        <span className="text-sm text-muted-foreground">{formatUsd(p.totalChargeCents)}</span>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        User: {p.user?.email || p.userId} • {p.user?.username ? `@${p.user.username}` : ""}
                      </div>

                      <div className="text-xs text-muted-foreground">
                        ID: <span className="font-mono">{p.id}</span>
                      </div>

                      {p.reference ? (
                        <div className="text-xs">
                          Reference: <span className="font-mono text-foreground">{p.reference}</span>
                        </div>
                      ) : null}

                      {p.proofUrl ? (
                        <div className="text-xs">
                          Proof:{" "}
                          <a href={p.proofUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                            View
                          </a>
                        </div>
                      ) : null}

                      {p.note ? (
                        <div className="text-xs text-muted-foreground">Note: {p.note}</div>
                      ) : null}

                      <div className="text-xs text-muted-foreground">
                        Created: {new Date(p.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {p.status === "SUBMITTED" || p.status === "INITIATED" ? (
                        <Button
                          size="sm"
                          onClick={() => verify(p.id)}
                          disabled={verifying === p.id}
                        >
                          {verifying === p.id ? "Verifying..." : "Verify & Activate"}
                        </Button>
                      ) : p.status === "VERIFIED" ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400">
                          Activated
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}