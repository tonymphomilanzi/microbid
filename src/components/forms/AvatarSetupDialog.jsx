import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import ImageUpload from "./ImageUpload";
import UserAvatar from "../shared/UserAvatar";
import { listingsService } from "../../services/listings.service";

function useMediaQuery(query) {
  const getMatches = () =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false;

  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(query);

    const onChange = () => setMatches(mql.matches);
    onChange();

    // safari fallback
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange);

    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, [query]);

  return matches;
}

export default function AvatarSetupDialog({
  open,
  onOpenChange,
  initialAvatarUrl = "",
  onSaved,
}) {
  const isDesktop = useMediaQuery("(min-width: 640px)"); // tailwind sm breakpoint

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
      // "" => clears => default avatar
      const { user } = await listingsService.setAvatar(value);
      onSaved?.(user?.avatarUrl || "");
      onOpenChange(false);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to save avatar.");
    } finally {
      setSaving(false);
    }
  }

  const Content = (
    <div className="space-y-4">
      {/* Preview */}
      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/10 p-3">
        <UserAvatar src={value} size={44} />
        <div className="text-xs text-muted-foreground">
          {value ? "Shown on listings & comments." : "Using default avatar."}
        </div>
      </div>

      <Separator className="bg-border/60" />

      {/* Upload */}
      <div className="space-y-2">
        <div className="text-sm font-semibold">Upload</div>
        <div className="max-w-[240px]">
          <ImageUpload value={value} onChange={setValue} mode="tile" />
        </div>
        <div className="text-[11px] text-muted-foreground">Square images look best.</div>
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

      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={() => onOpenChange(false)}
        disabled={saving}
      >
        Close
      </Button>
    </div>
  );

  // Desktop: Dialog
  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Set avatar</DialogTitle>
          </DialogHeader>
          {Content}
        </DialogContent>
      </Dialog>
    );
  }

  // Mobile: Bottom Sheet
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="border-border/60 bg-card p-0">
        {/* grab handle */}
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-muted" />

        <div className="max-h-[85vh] overflow-y-auto px-4 pb-6 pt-4">
          <SheetHeader className="pb-2">
            <SheetTitle>Set avatar</SheetTitle>
          </SheetHeader>

          {Content}
        </div>
      </SheetContent>
    </Sheet>
  );
}