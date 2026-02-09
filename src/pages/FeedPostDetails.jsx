import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "../components/ui/drawer";
import { feedService } from "../services/feed.service";
import { useAuth } from "../context/AuthContext";
import { Heart, MessageSquare, Share2, Send } from "lucide-react";
import ShareSheet from "../components/shared/ShareSheet";

// shadcn toast
import { useToast } from "../hooks/use-toast";
import { ToastAction } from "../components/ui/toast";

function AuthorHandle({ username }) {
  if (username) return <span className="font-medium">@{username}</span>;
  return <span className="select-none blur-[3px]">@private_user</span>;
}

export default function FeedPostDetails() {
  const { id } = useParams();
  const { user, openAuthModal } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState(null);
  const [error, setError] = useState("");

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);

  const commentInputRef = useRef(null);

  const shareUrl = useMemo(() => {
    return `${window.location.origin}/feed/${id}`;
  }, [id]);

  useEffect(() => {
    let mounted = true;

    async function run() {
      setLoading(true);
      setError("");
      try {
        const { post } = await feedService.getPost(id); // uses /api/me?public=feed&id=...
        if (!mounted) return;
        setPost(post);
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || e.message || "Failed to load post");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (id) run();
    return () => (mounted = false);
  }, [id]);

  useEffect(() => {
    if (!commentsOpen) return;
    // focus composer when opening drawer
    setTimeout(() => commentInputRef.current?.focus(), 120);
  }, [commentsOpen]);

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

  async function onToggleLike() {
    if (!user) return needLoginToast();
    if (!post?.id) return;

    // optimistic update
    setPost((p) => {
      if (!p) return p;
      const nextLiked = !p.likedByMe;
      return {
        ...p,
        likedByMe: nextLiked,
        likeCount: Math.max(0, (p.likeCount || 0) + (nextLiked ? 1 : -1)),
      };
    });

    try {
      const res = await feedService.toggleLike(post.id);
      setPost((p) =>
        !p
          ? p
          : {
              ...p,
              likedByMe: res.liked,
              likeCount: res.likeCount,
              commentCount: res.commentCount,
            }
      );
    } catch (e) {
      toast({
        title: "Could not like post",
        description: e?.response?.data?.message || e.message || "Try again.",
      });
      // refetch to be safe
      const { post: fresh } = await feedService.getPost(id);
      setPost(fresh);
    }
  }

  function onOpenComments() {
    setCommentsOpen(true);
  }

  async function onAddComment() {
    if (!user) return needLoginToast();
    if (!post?.id) return;

    const text = commentText.trim();
    if (!text) {
      toast({ title: "Comment is empty", description: "Type something first." });
      return;
    }

    setCommentLoading(true);
    try {
      const res = await feedService.addComment(post.id, text);

      setPost((p) => {
        if (!p) return p;
        return {
          ...p,
          likeCount: res.likeCount ?? p.likeCount,
          commentCount: res.commentCount ?? p.commentCount,
          comments: [res.comment, ...(p.comments ?? [])],
        };
      });

      setCommentText("");
      // keep focus in composer like chat apps
      setTimeout(() => commentInputRef.current?.focus(), 0);
    } catch (e) {
      toast({
        title: "Could not post comment",
        description: e?.response?.data?.message || e.message || "Try again.",
      });
    } finally {
      setCommentLoading(false);
    }
  }

  async function onShare() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: post?.title || "Feed post",
          text: (post?.body || "").slice(0, 120),
          url: shareUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "Link copied", description: "Share it anywhere." });
    } catch (e) {
      toast({
        title: "Share failed",
        description: e?.message || "Could not share this post.",
      });
    }
  }

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

  return (
    <PageContainer>
      <div className="py-8 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="ghost">
            <Link to="/feed">← Back</Link>
          </Button>
        </div>

        <Card className="border-border/60 bg-card/60 overflow-hidden">
          {post.image ? (
            <div className="relative aspect-[16/7] bg-muted">
              <img src={post.image} alt={post.title} className="h-full w-full object-cover" />
            </div>
          ) : null}

          <CardContent className="p-6 space-y-4">
            {/* Title + meta */}
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">{post.title}</h1>
              <div className="text-xs text-muted-foreground">
                Posted by <AuthorHandle username={post.author?.username} /> •{" "}
                {post.createdAt ? new Date(post.createdAt).toLocaleString() : ""}
              </div>
            </div>

            {/* Action bar (Like | Comment | Share) */}
            <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-border/60 bg-muted/10">
              <button
                type="button"
                className="flex items-center justify-center gap-2 px-3 py-3 text-sm transition hover:bg-muted/20"
                onClick={onToggleLike}
              >
                <Heart
                  className={[
                    "h-4 w-4",
                    post.likedByMe ? "fill-primary text-primary" : "text-muted-foreground",
                  ].join(" ")}
                />
                <span className="font-medium">{post.likeCount ?? 0}</span>
              </button>

              <button
                type="button"
                className="flex items-center justify-center gap-2 border-x border-border/60 px-3 py-3 text-sm transition hover:bg-muted/20"
                onClick={() => {
                  // allow viewing comments even when logged out, but toast if trying to interact
                  onOpenComments();
                }}
              >
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{post.commentCount ?? 0}</span>
              </button>

              <ShareSheet url={shareUrl} title={post.title} text={(post.body || "").slice(0, 120)}>
  <button
    type="button"
    className="flex items-center justify-center gap-2 border-x border-border/60 px-3 py-3 text-sm transition hover:bg-muted/20"
  >
    <Share2 className="h-4 w-4 text-muted-foreground" />
    <span className="font-medium">Share</span>
  </button>
</ShareSheet>
            </div>

            {/* Body */}
            <div className="whitespace-pre-wrap break-words text-sm text-muted-foreground leading-6">
              {post.body}
            </div>
          </CardContent>
        </Card>

        {/* Comments bottom sheet */}
        <Drawer open={commentsOpen} onOpenChange={setCommentsOpen}>
          <DrawerContent className="max-h-[85vh]">
            <div className="mx-auto w-full max-w-2xl px-4 pb-4">
              <DrawerHeader className="px-0">
                <DrawerTitle>Comments</DrawerTitle>
                <div className="text-xs text-muted-foreground">
                  {post.commentCount ?? 0} total
                </div>
              </DrawerHeader>

              {/* comments list + composer */}
              <div className="flex h-[70vh] flex-col">
                {/* list */}
                <div className="flex-1 overflow-auto pr-1 space-y-3">
                  {!post.comments?.length ? (
                    <div className="rounded-xl border border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground">
                      No comments yet. Be the first.
                    </div>
                  ) : (
                    (post.comments ?? []).map((c) => (
                      <div key={c.id} className="rounded-xl border border-border/60 bg-muted/10 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm">
                            <AuthorHandle username={c.author?.username} />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {c.createdAt ? new Date(c.createdAt).toLocaleString() : ""}
                          </div>
                        </div>

                        <div className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                          {c.body}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* composer (chat-like) */}
                <div className="mt-3 rounded-xl border border-border/60 bg-card/60 p-3">
                  <div className="flex items-end gap-2">
                    <Textarea
                      ref={commentInputRef}
                      placeholder={user ? "Write a comment…" : "Login to comment…"}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      disabled={!user || commentLoading}
                      rows={2}
                      className="min-h-[44px] resize-none"
                      onKeyDown={(e) => {
                        // Enter to send (Shift+Enter for newline)
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          onAddComment();
                        }
                      }}
                    />

                    <Button
                      type="button"
                      className="h-11 shrink-0 gap-2"
                      disabled={!user || commentLoading}
                      onClick={onAddComment}
                    >
                      <Send className="h-4 w-4" />
                      Send
                    </Button>
                  </div>

                  {!user ? (
                    <div className="mt-2 text-xs text-muted-foreground">
                      You must be logged in to comment.{" "}
                      <button
                        type="button"
                        className="text-primary underline underline-offset-4"
                        onClick={() => {
                          needLoginToast();
                          openAuthModal?.();
                        }}
                      >
                        Login
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </PageContainer>
  );
}