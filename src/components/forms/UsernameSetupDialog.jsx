import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { listingsService } from "../../services/listings.service";

function normalizeUsername(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

export default function UsernameSetupDialog({
  open,
  onOpenChange,
  initialUsername = "",
  onSaved, // (newUsername) => void
}) {
  const [username, setUsername] = useState(initialUsername || "");
  const normalized = useMemo(() => normalizeUsername(username), [username]);

  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState(null); // null | true | false
  const [suggestions, setSuggestions] = useState([]);
  const [message, setMessage] = useState("");

  const [saving, setSaving] = useState(false);

  // Reset when opened
  useEffect(() => {
    if (!open) return;
    setUsername(initialUsername || "");
    setAvailable(null);
    setSuggestions([]);
    setMessage("");
  }, [open, initialUsername]);

  // Debounced availability check
  useEffect(() => {
    if (!open) return;

    let t;
    async function run() {
      setMessage("");
      setSuggestions([]);
      setAvailable(null);

      if (!normalized) return;

      setChecking(true);
      try {
        const res = await listingsService.checkUsername(normalized);
        setAvailable(Boolean(res.available));
        setMessage(
          res.available
            ? "Username is available"
            : res.reason || "Username is taken"
        );
        setSuggestions(res.suggestions || []);
      } catch (e) {
        setAvailable(null);
        setMessage(e?.response?.data?.message || e.message || "Failed to check username");
      } finally {
        setChecking(false);
      }
    }

    t = setTimeout(run, 450);
    return () => clearTimeout(t);
  }, [normalized, open]);

  async function save() {
    if (!normalized) {
      setMessage("Please enter a username.");
      return;
    }
    if (available !== true) {
      setMessage("Please choose an available username.");
      return;
    }

    setSaving(true);
    try {
      await listingsService.setUsername(normalized);
      onSaved?.(normalized);
      onOpenChange?.(false);
    } catch (e) {
      setMessage(e?.response?.data?.message || e.message || "Failed to save username");
    } finally {
      setSaving(false);
    }
  }

  const statusBadge = useMemo(() => {
    if (!normalized) return null;
    if (checking) {
      return (
        <Badge variant="outline" className="border-border/60 bg-muted/20">
          Checking…
        </Badge>
      );
    }
    if (available === true) {
      return (
        <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
          Available
        </Badge>
      );
    }
    if (available === false) {
      return (
        <Badge className="bg-destructive/15 text-destructive border border-destructive/20">
          Taken
        </Badge>
      );
    }
    return null;
  }, [normalized, checking, available]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/60 bg-card text-card-foreground sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Set your username</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Your email stays private. Your username will be shown publicly on listings and chat.
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                placeholder="e.g. microbid_seller"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              {statusBadge}
            </div>

            <div className="text-xs text-muted-foreground">
              3–20 characters • letters, numbers, underscore only
            </div>

            {message ? (
              <div className={`text-xs ${available ? "text-emerald-300" : "text-muted-foreground"}`}>
                {message}
              </div>
            ) : null}

            {suggestions.length ? (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setUsername(s)}
                  >
                    @{s}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || checking || available !== true}>
              {saving ? "Saving..." : "Save username"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}