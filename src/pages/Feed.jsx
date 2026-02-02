import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useAuth } from "../context/AuthContext";
import { feedService } from "../services/feed.service";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Share2, Copy, Check } from "lucide-react";

const TAGS = ["ALL", "NEW", "UPDATE", "CHANGELOG"];

function TagBadge({ tag }) {
  const map = {
    NEW: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
    UPDATE: "bg-sky-500/15 text-sky-300 border-sky-500/20",
    CHANGELOG: "bg-violet-500/15 text-violet-300 border-violet-500/20",
  };
  return (
    <Badge variant="outline" className={map[tag] || "border-border/60 bg-muted/20"}>
      {tag}
    </Badge>
  );
}

function AuthorHandle({ username }) {
  if (username) return <span className="font-medium">@{username}</span>;
  return <span className="select-none blur-[3px]">@private_user</span>;
}

/** Real-ish simple SVG icons (no extra libraries) */
function XIcon({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M18.9 2H22l-6.8 7.8L23.2 22h-6.7l-5.3-6.6L5.6 22H2.4l7.3-8.4L1 2h6.9l4.8 6.1L18.9 2Zm-1.2 18h1.7L7 3.9H5.2l12.5 16.1Z"
      />
    </svg>
  );
}

function WhatsAppIcon({ className = "h-4 w-4" }) {
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

function TelegramIcon({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M9.6 15.6 9.4 19c.4 0 .6-.2.8-.4l1.9-1.8 3.9 2.9c.7.4 1.2.2 1.4-.6l2.5-11.7c.2-.9-.3-1.2-.9-1L2.7 10.2c-.9.4-.9 1 0 1.3l4.3 1.3 10-6.3c.5-.3 1-.1.6.2L9.6 15.6Z"
      />
    </svg>
  );
}

function ShareMenu({ url, title, text }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  const shareText = encodeURIComponent(`${title}\n\n${text || ""}`.trim());
  const shareUrl = encodeURIComponent(url);

  const xHref = `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`;
  const tgHref = `https://t.me/share/url?url=${shareUrl}&text=${encodeURIComponent(title)}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Share2 className="h-4 w-4" />
          Share
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={copy} className="gap-2">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          Copy link
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="gap-2">
          <a href={xHref} target="_blank" rel="noreferrer">
            <XIcon className="h-4 w-4" />
            Share to X
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="gap-2">
          <a href={waHref} target="_blank" rel="noreferrer">
            <WhatsAppIcon className="h-4 w-4" />
            Share to WhatsApp
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="gap-2">
          <a href={tgHref} target="_blank" rel="noreferrer">
            <TelegramIcon className="h-4 w-4" />
            Share to Telegram
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Feed() {
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();

  const highlightId = sp.get("post") || "";

  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);

  const [q, setQ] = useState("");
  const [tag, setTag] = useState("ALL");
  const [category, setCategory] = useState("");

  const [error, setError] = useState("");
  const [flashId, setFlashId] = useState("");

  const params = useMemo(() => {
    return {
      q: q || undefined,
      tag: tag === "ALL" ? undefined : tag,
      category: category || undefined,
    };
  }, [q, tag, category]);

  async function load() {
    setError("");
    setLoading(true);
    try {
      const { posts } = await feedService.listPublic(params);
      setPosts(posts || []);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to load feed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.q, params.tag, params.category]);

  // Mark as seen (so navbar badge resets) when opening the feed
  useEffect(() => {
    if (!user) return;
    feedService.markSeen().catch(() => {});
  }, [user]);

  // Scroll + highlight if opened via shared link
  useEffect(() => {
    if (!highlightId) return;
    if (loading) return;

    const el = document.getElementById(`post-${highlightId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setFlashId(highlightId);
      setTimeout(() => setFlashId(""), 2200);
    }
  }, [highlightId, loading]);

  return (
    <PageContainer>
      <div className="py-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Feed</h1>
          <p className="text-sm text-muted-foreground">
            Updates, news and changelogs — posted by the Microbid team.
          </p>
        </div>

        {/* Filters */}
        <Card className="border-border/60 bg-card/60 backdrop-blur">
          <CardContent className="p-4 space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <Input placeholder="Search updates..." value={q} onChange={(e) => setQ(e.target.value)} />
              <Input
                placeholder="Category (optional)"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
              <Button variant="outline" onClick={load} disabled={loading}>
                Refresh
              </Button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TAGS.map((t) => (
                <Button
                  key={t}
                  variant={t === tag ? "default" : "outline"}
                  className="shrink-0 rounded-full"
                  onClick={() => setTag(t)}
                >
                  {t}
                </Button>
              ))}
            </div>

            {highlightId ? (
              <div className="text-xs text-muted-foreground">
                Showing shared post •{" "}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSp({}, { replace: true })}
                >
                  Clear
                </Button>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                Tip: Share posts with the menu on each post.
              </div>
            )}
          </CardContent>
        </Card>

        {error ? (
          <Card className="border-border/60 bg-card/60">
            <CardContent className="p-5">
              <div className="text-sm font-medium">Could not load feed</div>
              <div className="mt-1 text-sm text-muted-foreground">{error}</div>
              <div className="mt-4">
                <Button variant="outline" onClick={load}>Retry</Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Posts */}
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading feed…</div>
        ) : posts.length === 0 ? (
          <Card className="border-border/60 bg-card/60">
            <CardContent className="p-6 text-sm text-muted-foreground">No posts yet.</CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {posts.map((p) => {
              const shareUrl = `${window.location.origin}/feed?post=${p.id}`;
              const flash = flashId === p.id;

              return (
                <Card
                  key={p.id}
                  id={`post-${p.id}`}
                  className={[
                    "border-border/60 bg-card/60 backdrop-blur overflow-hidden scroll-mt-24 transition",
                    flash ? "ring-2 ring-primary/30" : "",
                  ].join(" ")}
                >
                  {p.image ? (
                    <div className="relative aspect-[16/7] bg-muted">
                      <img src={p.image} alt={p.title} className="h-full w-full object-cover" loading="lazy" />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
                    </div>
                  ) : null}

                  <CardContent className="p-5 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-semibold truncate">{p.title}</h2>

                          {(p.tags || []).map((t) => (
                            <TagBadge key={t} tag={t} />
                          ))}

                          {p.category ? (
                            <Badge variant="outline" className="border-border/60 bg-muted/20">
                              {p.category}
                            </Badge>
                          ) : null}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          Posted by <AuthorHandle username={p.author?.username} /> •{" "}
                          {new Date(p.createdAt).toLocaleString()}
                        </div>
                      </div>

                      <ShareMenu
                        url={shareUrl}
                        title={p.title}
                        text={p.body?.slice(0, 120)}
                      />
                    </div>

                    <div className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {p.body}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PageContainer>
  );
}