import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useAuth } from "../context/AuthContext";
import { feedService } from "../services/feed.service";

const TAGS = ["ALL", "NEW", "UPDATE", "CHANGELOG"];

export default function Feed() {
  const { user } = useAuth();
  const [sp] = useSearchParams();
  const navigate = useNavigate();

  // Backward compatibility: if someone hits /feed?post=xxx, send them to full post page
  const highlightId = sp.get("post") || "";
  useEffect(() => {
    if (highlightId) navigate(`/feed/${highlightId}`, { replace: true });
  }, [highlightId, navigate]);

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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.q, params.tag, params.category]);

  // Mark as seen (so navbar badge resets) when opening the feed
  useEffect(() => {
    if (!user) return;
    feedService.markSeen().catch(() => {});
  }, [user]);

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

        {/* Posts (preview only) */}
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading feed…</div>
        ) : posts.length === 0 ? (
          <Card className="border-border/60 bg-card/60">
            <CardContent className="p-6 text-sm text-muted-foreground">No posts yet.</CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <Card
                key={p.id}
                className="border-border/60 bg-card/60 backdrop-blur overflow-hidden"
              >
                {p.image ? (
                  <div className="relative aspect-[16/9] bg-muted">
                    <img
                      src={p.image}
                      alt={p.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="aspect-[16/9] bg-muted/30" />
                )}

                <CardContent className="p-4">
                  <h2 className="text-sm font-semibold leading-snug line-clamp-2">
                    {p.title}
                  </h2>

                  <div className="mt-3">
                    <Button asChild variant="outline" size="sm" className="w-full">
                      {/* pass post in state so details loads instantly */}
                      <Link to={`/feed/${p.id}`} state={{ post: p }}>
                        See more
                      </Link>
                    </Button>
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