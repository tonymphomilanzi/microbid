import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { Image as ImageIcon, UploadCloud, Plus, X } from "lucide-react";
import { listingsService } from "../../services/listings.service";

export default function ImageUpload({
  value,
  onChange,
  mode = "cover", // "cover" | "tile"
}) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(value || "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  // Keep preview in sync (IMPORTANT: also handle clearing)
  useEffect(() => {
    setPreview(value || "");
  }, [value]);

  async function handleFile(file) {
    setError("");

    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image too large. Max size is 5MB.");
      return;
    }

    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUploading(true);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const { url } = await listingsService.uploadImage(fd);

      onChange(url);
      setPreview(url);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Upload failed");
      setPreview(value || "");
    } finally {
      setUploading(false);
      if (localUrl?.startsWith("blob:")) URL.revokeObjectURL(localUrl);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const openPicker = () => inputRef.current?.click();

  // --- TILE MODE (gallery slot) ---
  if (mode === "tile") {
    return (
      <div className="space-y-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        <button
          type="button"
          onClick={openPicker}
          disabled={uploading}
          className="relative aspect-square w-full overflow-hidden rounded-lg border border-border/60 bg-muted/20 outline-none transition hover:bg-muted/30 disabled:opacity-60"
        >
          {preview ? (
            <img src={preview} alt="Preview" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <Plus className="h-5 w-5" />
              <span className="text-xs">Add</span>
            </div>
          )}

          {uploading ? (
            <div className="absolute inset-0 grid place-items-center bg-black/40 text-xs text-white">
              Uploading...
            </div>
          ) : null}

          {/* Remove (only if there is a value) */}
          {value ? (
            <span
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange("");
              }}
              className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/75"
              title="Remove"
            >
              <X className="h-4 w-4" />
            </span>
          ) : null}
        </button>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}
      </div>
    );
  }

  // --- COVER MODE (your original UI) ---
  return (
    <div className="space-y-3">
      <div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-border/60 bg-muted/20">
        {preview ? (
          <img src={preview} alt="Preview" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ImageIcon className="h-6 w-6" />
          </div>
        )}

        {uploading ? (
          <div className="absolute inset-0 grid place-items-center bg-black/40 text-sm text-white">
            Uploading...
          </div>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        onClick={openPicker}
        disabled={uploading}
      >
        <UploadCloud className="h-4 w-4" />
        {uploading ? "Uploading..." : value ? "Replace Image" : "Upload Image"}
      </Button>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
    </div>
  );
}