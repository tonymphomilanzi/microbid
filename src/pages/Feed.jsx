import { useEffect, useMemo, useState } from "react";
import PageContainer from "../components/layout/PageContainer";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useAuth } from "../context/AuthContext";
import { feedService } from "../services/feed.service";

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

  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);

  const [q, setQ] = useState("");
  const [tag, setTag] = useState("ALL");
  const [category, setCategory] = useState("");

  const [error, setError] = useState("");

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

  // Load feed
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.q, params.tag, params.category]);

  // Mark as seen (so navbar badge resets)
  useEffect(() => {
    if (!user) return;
    // fire and forget
    feedService.markSeen().catch(() => {});
  }, [user]);

  return (
    <PageContainer>
      <div className="py-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Feed</h1>
          <p className="text-sm text-muted-foreground">
            Product updates, news and changelogs — posted by the Mikrobid team.
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
              {/**<Input
                placeholder="Category (optional)"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />**/}
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

            <div className="text-xs text-muted-foreground">
              Tip: Use tags for quick browsing.
            </div>
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
            <CardContent className="p-6 text-sm text-muted-foreground">
              No posts yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {posts.map((p) => (
              <Card
                key={p.id}
                className="border-border/60 bg-card/60 backdrop-blur overflow-hidden"
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
                  </div>

                  <div className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {p.body}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}