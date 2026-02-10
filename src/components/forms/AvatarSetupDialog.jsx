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
      const { user } = await listingsService.setAvatar(value);
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
      <DialogContent className="sm:max-w-sm p-4 max-h-[85vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base">Set avatar</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Preview */}
          <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/10 p-3">
            <UserAvatar src={value} size={40} />
            <div className="text-xs text-muted-foreground">
              {value ? "Shown on listings & comments." : "Using default avatar."}
            </div>
          </div>

          <Separator className="bg-border/60" />

          {/* Upload (tile mode is compact) */}
          <div className="space-y-2">
            <div className="text-sm font-semibold">Upload</div>
            <div className="max-w-[220px]">
              <ImageUpload value={value} onChange={setValue} mode="tile" />
            </div>
            <div className="text-[11px] text-muted-foreground">
              Square images look best.
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => setValue("")}
              disabled={saving}
            >
              Default
            </Button>
          </div>

          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}