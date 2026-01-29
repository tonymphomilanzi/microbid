import { useRef, useState } from "react";
import { Button } from "../ui/button";
import { Image as ImageIcon, UploadCloud } from "lucide-react";
import { listingsService } from "../../services/listings.service";

export default function ImageUpload({ value, onChange }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(value || "");
  const [uploading, setUploading] = useState(false);

  async function handleFile(file) {
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { url } = await listingsService.uploadImage(fd);
      onChange(url);
      setPreview(url);
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
        {uploading ? "Uploading..." : "Upload Image"}
      </Button>
    </div>
  );
}