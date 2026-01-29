import { useRef, useState } from "react";
import { Button } from "../ui/button";
import { Image as ImageIcon, UploadCloud } from "lucide-react";
import { listingsService } from "../../services/listings.service";

export default function ImageUpload({ value, onChange }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(value || "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file) {
    setError("");
    setPreview(URL.createObjectURL(file));
    setUploading(true);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const { url } = await listingsService.uploadImage(fd);
      onChange(url);         // IMPORTANT: sets form.image
      setPreview(url);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[16/10] overflow-hidden rounded-lg border bg-muted">
        {preview ? (
          <img src={preview} alt="Preview" className="h-full w-full object-cover" />
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