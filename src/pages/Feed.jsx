import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useAuth } from "../context/AuthContext";
import { feedService } from "../services/feed.service";
import FeedPostSkeleton from "../components/feed/FeedPostSkeleton";
import { Heart, MessageSquare, ArrowRight, RefreshCcw, Search, Folder } from "lucide-react";

// shadcn toast (adjust path if yours differs)
import { useToast } from "../hooks/use-toast";
import { ToastAction } from "../components/ui/toast";

const TAGS = ["ALL", "NEW", "UPDATE", "CHANGELOG"];

export default function Feed() {
  const { user, openAuthModal } = useAuth();
  const { toast } = useToast();

  const [sp] = useSearchParams();
  const navigate = useNavigate();

  // Backward compatibility: /feed?post=xxx -> /feed/xxx
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

  useEffect(() => {
    if (!user) return;
    feedService.markSeen().catch(() => {});
  }, [user]);

  function needLoginToast() {
    toast({
      title: "Login required",
      description: "Please login to like or comment.",
      action: (
        <ToastAction altText="Login" onClick={openAuthModal}>
          Login
        </ToastAction>
      ),
    });
  }

  async function onToggleLike(postId) {
    if (!user) return needLoginToast();

    // optimistic update
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const liked = !p.likedByMe;
        return {
          ...p,
          likedByMe: liked,
          likeCount: Math.max(0, (p.likeCount || 0) + (liked ? 1 : -1)),
        };
      })
    );

    try {
      const res = await feedService.toggleLike(postId);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, likedByMe: res.liked, likeCount: res.likeCount, commentCount: res.commentCount }
            : p
        )
      );
    } catch (e) {
      // revert by refetch (simplest + consistent)
      load();
      toast({
        title: "Could not like post",
        description: e?.response?.data?.message || e.message || "Try again.",
      });
    }
  }

  return (
    <div className="relative overflow-hidden">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-[-10%] h-[520px] w-[520px] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_30%_0%,rgba(250,204,21,0.10),transparent_55%)]" />
      </div>

      <PageContainer className="relative">
        <div className="py-8 space-y-6">
          {/* Header */}
          <section className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">Feed updates</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Updates, news and changelogs — posted by the Mikrobid team.
            </p>
          </section>

          {/* Filters */}
          <Card className="rounded-2xl border-border/60 bg-card/60 backdrop-blur">
            <CardContent className="p-4 sm:p-5 space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search updates..."
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>

                <div className="relative">
                  <Folder className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Category (optional)"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                </div>

                <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
                  <RefreshCcw className="h-4 w-4" />
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
            <Card className="rounded-2xl border-border/60 bg-card/60">
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
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <FeedPostSkeleton key={i} />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <Card className="rounded-2xl border-border/60 bg-card/60">
              <CardContent className="p-6 text-sm text-muted-foreground">No posts yet.</CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {posts.map((p) => (
                <Card
                  key={p.id}
                  className="group overflow-hidden rounded-2xl border-border/60 bg-card/55 backdrop-blur transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5"
                >
                  {/* Image */}
                  <div className="relative aspect-[16/9] bg-muted">
                    {p.image ? (
                      <>
                        <img
                          src={p.image}
                          alt={p.title}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                          loading="lazy"
                        />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/55 via-transparent to-transparent opacity-70" />
                      </>
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-muted/40 to-muted/10" />
                    )}
                  </div>

                  <CardContent className="p-4 sm:p-5 space-y-3">
                    <h2 className="text-base font-semibold leading-snug">
                      <span className="line-clamp-2">{p.title}</span>
                    </h2>

                    {/* Like + comment counts */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => onToggleLike(p.id)}
                        >
                          <Heart
                            className={[
                              "h-4 w-4",
                              p.likedByMe ? "fill-primary text-primary" : "text-muted-foreground",
                            ].join(" ")}
                          />
                          <span className="text-sm">{p.likeCount ?? 0}</span>
                        </Button>

                        <Button asChild variant="outline" size="sm" className="gap-2">
                          <Link to={`/feed/${p.id}`} state={{ post: p, focusComment: true }}>
                            <MessageSquare className="h-4 w-4" />
                            <span className="text-sm">{p.commentCount ?? 0}</span>
                          </Link>
                        </Button>
                      </div>

                      <Button asChild variant="default" size="sm" className="gap-2">
                        <Link to={`/feed/${p.id}`} state={{ post: p }}>
                          See more <ArrowRight className="h-4 w-4" />
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
    </div>
  );
}