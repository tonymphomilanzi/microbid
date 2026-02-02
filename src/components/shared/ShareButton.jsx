import { useState } from "react";
import { Button } from "../ui/button";
import { Share2, Copy, Check } from "lucide-react";

export default function ShareButton({ url, title, text, variant = "outline", size = "sm" }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  async function share() {
    // Web Share API (best experience on mobile)
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // user canceled -> ignore
      }
    }

    // fallback
    try {
      await copyLink();
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  return (
    <Button variant={variant} size={size} onClick={share} className="gap-2">
      <Share2 className="h-4 w-4" />
      Share
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4 opacity-70" />}
    </Button>
  );
}