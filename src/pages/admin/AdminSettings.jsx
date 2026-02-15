import { useEffect, useMemo, useState } from "react";
import { adminService } from "../../services/admin.service";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Separator } from "../../components/ui/separator";

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState({
    escrowAgentUid: "",
    escrowFeeBps: 200,

    companyBtcAddress: "",
    companyBtcNetwork: "",

    companyMomoName: "",
    companyMomoNumber: "",
    companyMomoCountry: "",

    companyWuName: "",
    companyWuCountry: "",
    companyWuCity: "",

    companyBankName: "",
    companyBankAccountName: "",
    companyBankAccountNumber: "",
    companyBankSwift: "",
    companyBankCountry: "",
  });

  async function load() {
    setError("");
    setLoading(true);
    try {
      const res = await adminService.getSettings();
      const s = res.settings;

      setSettings(s);
      setDraft({
        escrowAgentUid: s?.escrowAgentUid ?? "",
        escrowFeeBps: s?.escrowFeeBps ?? 200,

        companyBtcAddress: s?.companyBtcAddress ?? "",
        companyBtcNetwork: s?.companyBtcNetwork ?? "",

        companyMomoName: s?.companyMomoName ?? "",
        companyMomoNumber: s?.companyMomoNumber ?? "",
        companyMomoCountry: s?.companyMomoCountry ?? "",

        companyWuName: s?.companyWuName ?? "",
        companyWuCountry: s?.companyWuCountry ?? "",
        companyWuCity: s?.companyWuCity ?? "",

        companyBankName: s?.companyBankName ?? "",
        companyBankAccountName: s?.companyBankAccountName ?? "",
        companyBankAccountNumber: s?.companyBankAccountNumber ?? "",
        companyBankSwift: s?.companyBankSwift ?? "",
        companyBankCountry: s?.companyBankCountry ?? "",
      });
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const feePercent = useMemo(() => {
    const bps = Number(draft.escrowFeeBps ?? 0);
    if (!Number.isFinite(bps)) return "—";
    return (bps / 100).toFixed(2); // 200 bps -> 2.00%
  }, [draft.escrowFeeBps]);

  const hasChanges = useMemo(() => {
    if (!settings) return false;

    const fields = Object.keys(draft);
    for (const k of fields) {
      const a = settings?.[k] ?? "";
      const b = draft?.[k] ?? "";
      if (String(a) !== String(b)) return true;
    }
    return false;
  }, [settings, draft]);

  async function save() {
    setSaving(true);
    setError("");
    try {
      // PATCH /admin/settings
      await adminService.updateSettings({
        escrowAgentUid: draft.escrowAgentUid,
        escrowFeeBps: Number(draft.escrowFeeBps),

        companyBtcAddress: draft.companyBtcAddress,
        companyBtcNetwork: draft.companyBtcNetwork,

        companyMomoName: draft.companyMomoName,
        companyMomoNumber: draft.companyMomoNumber,
        companyMomoCountry: draft.companyMomoCountry,

        companyWuName: draft.companyWuName,
        companyWuCountry: draft.companyWuCountry,
        companyWuCity: draft.companyWuCity,

        companyBankName: draft.companyBankName,
        companyBankAccountName: draft.companyBankAccountName,
        companyBankAccountNumber: draft.companyBankAccountNumber,
        companyBankSwift: draft.companyBankSwift,
        companyBankCountry: draft.companyBankCountry,
      });

      await load();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure escrow fee, escrow agent UID, and deposit details shown on checkout.
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

      {/* Escrow */}
      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium">Escrow</div>
            <Badge variant="outline" className="border-border/60 bg-muted/20">
              Fee: {feePercent}% ({draft.escrowFeeBps} bps)
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
          {/** *  <div>
                
              <div className="text-xs text-muted-foreground mb-1">Escrow Agent UID</div>
              <Input
                placeholder='e.g. "SYSTEM" or admin uid'
                value={draft.escrowAgentUid}
                onChange={(e) => setDraft((d) => ({ ...d, escrowAgentUid: e.target.value }))}
              />
              <div className="mt-1 text-xs text-muted-foreground">
                Stored in DB. Used to fill <code>escrowAgentId</code> on new transactions.
              </div>
            </div>*/} 

            <div>
              <div className="text-xs text-muted-foreground mb-1">Escrow Fee (bps)</div>
              <Input
                inputMode="numeric"
                placeholder="200"
                value={draft.escrowFeeBps}
                onChange={(e) => setDraft((d) => ({ ...d, escrowFeeBps: e.target.value }))}
              />
              <div className="mt-1 text-xs text-muted-foreground">
                200 bps = 2%. (0–2000 allowed)
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment details */}
      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium">Deposit details</div>
            <Badge variant="outline" className="border-border/60 bg-muted/20">
              Checkout instructions
            </Badge>
          </div>

          <Separator className="bg-border/60" />

          <div className="space-y-2">
            <div className="font-medium text-sm">Bitcoin</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="BTC address"
                value={draft.companyBtcAddress}
                onChange={(e) => setDraft((d) => ({ ...d, companyBtcAddress: e.target.value }))}
              />
              <Input
                placeholder='Network (e.g. "Bitcoin")'
                value={draft.companyBtcNetwork}
                onChange={(e) => setDraft((d) => ({ ...d, companyBtcNetwork: e.target.value }))}
              />
            </div>
          </div>

          <Separator className="bg-border/60" />

          <div className="space-y-2">
            <div className="font-medium text-sm">Mobile Money (MoMo)</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                placeholder="Account name"
                value={draft.companyMomoName}
                onChange={(e) => setDraft((d) => ({ ...d, companyMomoName: e.target.value }))}
              />
              <Input
                placeholder="MoMo number"
                value={draft.companyMomoNumber}
                onChange={(e) => setDraft((d) => ({ ...d, companyMomoNumber: e.target.value }))}
              />
              <Input
                placeholder="Country"
                value={draft.companyMomoCountry}
                onChange={(e) => setDraft((d) => ({ ...d, companyMomoCountry: e.target.value }))}
              />
            </div>
          </div>

          <Separator className="bg-border/60" />

          <div className="space-y-2">
            <div className="font-medium text-sm">Western Union</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                placeholder="Receiver name"
                value={draft.companyWuName}
                onChange={(e) => setDraft((d) => ({ ...d, companyWuName: e.target.value }))}
              />
              <Input
                placeholder="Receiver country"
                value={draft.companyWuCountry}
                onChange={(e) => setDraft((d) => ({ ...d, companyWuCountry: e.target.value }))}
              />
              <Input
                placeholder="Receiver city"
                value={draft.companyWuCity}
                onChange={(e) => setDraft((d) => ({ ...d, companyWuCity: e.target.value }))}
              />
            </div>
          </div>

          <Separator className="bg-border/60" />

          <div className="space-y-2">
            <div className="font-medium text-sm">Bank transfer</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Bank name"
                value={draft.companyBankName}
                onChange={(e) => setDraft((d) => ({ ...d, companyBankName: e.target.value }))}
              />
              <Input
                placeholder="Country"
                value={draft.companyBankCountry}
                onChange={(e) => setDraft((d) => ({ ...d, companyBankCountry: e.target.value }))}
              />
              <Input
                placeholder="Account name"
                value={draft.companyBankAccountName}
                onChange={(e) => setDraft((d) => ({ ...d, companyBankAccountName: e.target.value }))}
              />
              <Input
                placeholder="Account number"
                value={draft.companyBankAccountNumber}
                onChange={(e) => setDraft((d) => ({ ...d, companyBankAccountNumber: e.target.value }))}
              />
              <Input
                placeholder="SWIFT / IBAN"
                value={draft.companyBankSwift}
                onChange={(e) => setDraft((d) => ({ ...d, companyBankSwift: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          disabled={!hasChanges || saving}
          onClick={() => {
            // reset draft to last loaded settings
            const s = settings || {};
            setDraft({
              //escrowAgentUid: s?.escrowAgentUid ?? "",
              escrowFeeBps: s?.escrowFeeBps ?? 200,

              companyBtcAddress: s?.companyBtcAddress ?? "",
              companyBtcNetwork: s?.companyBtcNetwork ?? "",

              companyMomoName: s?.companyMomoName ?? "",
              companyMomoNumber: s?.companyMomoNumber ?? "",
              companyMomoCountry: s?.companyMomoCountry ?? "",

              companyWuName: s?.companyWuName ?? "",
              companyWuCountry: s?.companyWuCountry ?? "",
              companyWuCity: s?.companyWuCity ?? "",

              companyBankName: s?.companyBankName ?? "",
              companyBankAccountName: s?.companyBankAccountName ?? "",
              companyBankAccountNumber: s?.companyBankAccountNumber ?? "",
              companyBankSwift: s?.companyBankSwift ?? "",
              companyBankCountry: s?.companyBankCountry ?? "",
            });
          }}
        >
          Reset
        </Button>

        <Button disabled={!hasChanges || saving} onClick={save}>
          {saving ? "Saving..." : "Save settings"}
        </Button>
      </div>
    </div>
  );
}