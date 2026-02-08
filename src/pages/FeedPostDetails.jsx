import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { feedService } from "../services/feed.service";
import ShareSheet from "../components/shared/ShareSheet";

export default function FeedPostDetails() {
  const { id } = useParams();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState(location.state?.post ?? null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function run() {
      // If we already have the post from Link state, no need to fetch
      if (post?.id === id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const { posts } = await feedService.listPublic();
        const found = (posts || []).find((p) => p.id === id);

        if (!mounted) return;

        if (!found) {
          setError("Post not found.");
          setPost(null);
        } else {
          setPost(found);
        }
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || e.message || "Failed to load post");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (id) run();
    return () => (mounted = false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <PageContainer>
        <div className="py-10 text-sm text-muted-foreground">Loading…</div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <div className="py-10 space-y-3">
          <div className="text-sm font-medium">Could not load post</div>
          <div className="text-sm text-destructive">{error}</div>
          <Button asChild variant="outline">
            <Link to="/feed">Back to Feed</Link>
          </Button>
        </div>
      </PageContainer>
    );
  }

  if (!post) return null;

  const shareUrl = `${window.location.origin}/feed/${post.id}`;

  return (
    <PageContainer>
      <div className="py-8 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="ghost">
            <Link to="/feed">← Back</Link>
          </Button>

          <ShareSheet url={shareUrl} title={post.title} text={post.body?.slice(0, 120)} />
        </div>

        <Card className="border-border/60 bg-card/60 overflow-hidden">
          {post.image ? (
            <div className="relative aspect-[16/7] bg-muted">
              <img src={post.image} alt={post.title} className="h-full w-full object-cover" />
            </div>
          ) : null}

          <CardContent className="p-6 space-y-4">
            <h1 className="text-2xl font-semibold tracking-tight">{post.title}</h1>

            {/* preserve line breaks exactly as typed */}
            <div className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
              {post.body}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}