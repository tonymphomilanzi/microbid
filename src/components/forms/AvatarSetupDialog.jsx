import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Separator } from "../ui/separator";
import ImageUpload from "./ImageUpload";
import UserAvatar from "../shared/UserAvatar";
import { listingsService } from "../../services/listings.service";

export default function AvatarSetupDialog({
  open,
  onOpenChange,
  initialAvatarUrl = "",
  onSaved,
}) {
  const [value, setValue] = useState(initialAvatarUrl || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setValue(initialAvatarUrl || "");
    setError("");
  }, [open, initialAvatarUrl]);

  async function save() {
    setError("");
    setSaving(true);
    try {
      const { user } = await listingsService.setAvatar(value); // value can be "" to clear
      onSaved?.(user?.avatarUrl || "");
      onOpenChange(false);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to save avatar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Set your avatar</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview */}
          <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/10 p-3">
            <UserAvatar src={value} size={48} />
            <div className="text-sm">
              {value ? "This will appear publicly on your listings and comments." : "Using default avatar."}
            </div>
          </div>

          <Separator className="bg-border/60" />

          {/* Upload */}
          <div className="space-y-2">
            <div className="text-sm font-semibold">Upload avatar</div>
            <ImageUpload value={value} onChange={setValue} mode="tile" />
            <div className="text-xs text-muted-foreground">
              Tip: square images work best.
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save avatar"}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => setValue("")}
              disabled={saving}
            >
              Use default
            </Button>
          </div>

          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}