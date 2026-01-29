import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { Image as ImageIcon, UploadCloud } from "lucide-react";
import { listingsService } from "../../services/listings.service";

export default function ImageUpload({ value, onChange }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(value || "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  // Keep preview in sync if parent updates value (edit mode, reset, etc.)
  useEffect(() => {
    if (value) setPreview(value);
  }, [value]);

  async function handleFile(file) {
    setError("");

    // Basic validation (optional but recommended)
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image too large. Max size is 5MB.");
      return;
    }

    // Local preview (temporary blob URL)
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUploading(true);

    try {
      const fd = new FormData();
      fd.append("file", file); // must match backend field name: files.file

      const { url } = await listingsService.uploadImage(fd);

      onChange(url);   // sets form.image
      setPreview(url); // show Cloudinary URL after upload succeeds
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Upload failed");
      // revert preview back to last saved value if upload fails
      setPreview(value || "");
    } finally {
      setUploading(false);

      // prevent memory leaks from blob URLs
      if (localUrl?.startsWith("blob:")) URL.revokeObjectURL(localUrl);

      // allow selecting the same file again
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-border/60 bg-muted/20">
        {preview ? (
          <img
            src={preview}
            alt="Preview"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ImageIcon className="h-6 w-6" />
          </div>
        )}
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
        onClick={() => inputRef.current?.click()}
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
