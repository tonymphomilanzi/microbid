import { useMemo, useState } from "react";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "../ui/sheet";
import { Copy, Check, Share2, Link as LinkIcon, Mail } from "lucide-react";

function XIcon({ className = "h-6 w-6" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M18.9 2H22l-6.8 7.8L23.2 22h-6.7l-5.3-6.6L5.6 22H2.4l7.3-8.4L1 2h6.9l4.8 6.1L18.9 2Zm-1.2 18h1.7L7 3.9H5.2l12.5 16.1Z"
      />
    </svg>
  );
}

function WhatsAppIcon({ className = "h-6 w-6" }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.1 17.7c-.3-.2-1.7-.8-2-.9-.3-.1-.5-.2-.7.2-.2.3-.8.9-.9 1-.2.2-.3.2-.6.1-.3-.2-1.2-.4-2.3-1.4-.9-.8-1.4-1.8-1.6-2.1-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.1.2-.3.3-.5.1-.2 0-.4 0-.6-.1-.2-.7-1.7-1-2.3-.3-.6-.6-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.7 0 1.6 1.2 3.2 1.4 3.4.2.2 2.4 3.7 5.8 5.1.8.3 1.4.5 1.9.7.8.2 1.5.2 2.1.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4 0-.2-.3-.3-.6-.5Z"
      />
      <path
        fill="currentColor"
        d="M26.7 5.3A14 14 0 0 0 16.1 1C8.4 1 2.1 7.3 2.1 15c0 2.5.7 4.9 1.9 7L2 31l9.2-2.4c2 1.1 4.3 1.7 6.6 1.7 7.7 0 14-6.3 14-14 0-3.7-1.4-7.2-4-10Zm-10.6 22.6c-2.1 0-4.2-.6-6-1.7l-.4-.2-5.5 1.4 1.5-5.3-.3-.4A11.8 11.8 0 0 1 4.2 15C4.2 8.5 9.6 3.1 16.1 3.1c3.1 0 6.1 1.2 8.3 3.4a11.6 11.6 0 0 1 3.4 8.3c0 6.5-5.3 11.9-11.7 11.9Z"
      />
    </svg>
  );
}

function TelegramIcon({ className = "h-6 w-6" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M9.6 15.6 9.4 19c.4 0 .6-.2.8-.4l1.9-1.8 3.9 2.9c.7.4 1.2.2 1.4-.6l2.5-11.7c.2-.9-.3-1.2-.9-1L2.7 10.2c-.9.4-.9 1 0 1.3l4.3 1.3 10-6.3c.5-.3 1-.1.6.2L9.6 15.6Z"
      />
    </svg>
  );
}

function InstagramIcon({ className = "h-6 w-6" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9A5.5 5.5 0 0 1 16.5 22h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9A3.5 3.5 0 0 0 20 16.5v-9A3.5 3.5 0 0 0 16.5 4h-9ZM12 7a5 5 0 1 1 0 10a5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6a3 3 0 0 0 0-6Zm5.6-2.6a1 1 0 1 1 0 2a1 1 0 0 1 0-2Z"
      />
    </svg>
  );
}

function ShareTile({ icon, label, onClick, href, colorClass = "" }) {
  const inner = (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col items-center gap-2 rounded-xl border border-border/60 bg-card/60 p-3 transition hover:bg-muted/30"
    >
      <div className={`grid h-12 w-12 place-items-center rounded-full border border-border/60 bg-muted/20 ${colorClass}`}>
        {icon}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </button>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="block">
        {inner}
      </a>
    );
  }
  return inner;
}

export default function ShareSheet({ url, title, text, children }) {
  const [copied, setCopied] = useState(false);

  const shareText = useMemo(() => {
    const t = (text || "").trim();
    return t ? `${title}\n\n${t}` : title;
  }, [title, text]);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const hrefX = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodedUrl}`;
  const hrefWa = `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`;
  const hrefTg = `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`;
  const hrefFb = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
  const hrefLi = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
  const hrefReddit = `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`;
  const hrefMail = `mailto:?subject=${encodedTitle}&body=${encodeURIComponent(`${title}\n\n${url}`)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  async function systemShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url });
        return;
      } catch {
        // user canceled -> ignore
      }
    }
    await copyLink();
  }

  async function instagramShare() {
    await systemShare();
  }

  return (
    <Sheet>
      {/*  */}
      <SheetTrigger asChild>
        {children ? (
          children
        ) : (
          <Button variant="outline" size="sm" className="gap-2">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        )}
      </SheetTrigger>

      <SheetContent side="bottom" className="border-border/60 bg-card">
        <SheetHeader>
          <SheetTitle>Share</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
            <div className="text-sm font-medium truncate">{title}</div>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <LinkIcon className="h-4 w-4" />
              <span className="truncate">{url}</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
            <ShareTile
              icon={copied ? <Check className="h-6 w-6" /> : <Copy className="h-6 w-6" />}
              label={copied ? "Copied" : "Copy link"}
              onClick={copyLink}
            />

            <ShareTile icon={<Share2 className="h-6 w-6" />} label="More" onClick={systemShare} />

            <ShareTile icon={<InstagramIcon className="h-6 w-6" />} label="Instagram" onClick={instagramShare} colorClass="text-pink-300" />
            <ShareTile icon={<XIcon className="h-6 w-6" />} label="X" href={hrefX} />

            <ShareTile icon={<WhatsAppIcon className="h-6 w-6" />} label="WhatsApp" href={hrefWa} colorClass="text-emerald-300" />
            <ShareTile icon={<TelegramIcon className="h-6 w-6" />} label="Telegram" href={hrefTg} colorClass="text-sky-300" />

            <ShareTile icon={<span className="text-sm font-bold">f</span>} label="Facebook" href={hrefFb} colorClass="text-blue-300" />
            <ShareTile icon={<span className="text-sm font-bold">in</span>} label="LinkedIn" href={hrefLi} colorClass="text-sky-300" />
            <ShareTile icon={<span className="text-sm font-bold">r/</span>} label="Reddit" href={hrefReddit} colorClass="text-orange-300" />

            <ShareTile icon={<Mail className="h-6 w-6" />} label="Email" href={hrefMail} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}