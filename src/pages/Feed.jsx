import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useAuth } from "../context/AuthContext";
import { feedService } from "../services/feed.service";
import ShareSheet from "../components/shared/ShareSheet";

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
            Updates, news and changelogs — posted by the Mikrobid team.
          </p>
        </div>

        {/* Filters */}
        <Card className="border-border/60 bg-card/60 backdrop-blur">
          <CardContent className="p-4 space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                placeholder="Search updates..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
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
                <Button variant="ghost" size="sm" onClick={() => setSp({}, { replace: true })}>
                  Clear
                </Button>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                Tip: Share posts using the Share button.
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
                <Button variant="outline" onClick={load}>
                  Retry
                </Button>
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
              //const shareUrl = `${window.location.origin}/feed?post=${p.id}`;
              const shareUrl = `${window.location.origin}/share/feed?id=${p.id}`;
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
                      <img
                        src={p.image}
                        alt={p.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
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

                      {/* ✅ Instagram-style bottom sheet share */}
                      <ShareSheet
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