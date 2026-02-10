import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "../components/ui/drawer";
import { feedService } from "../services/feed.service";
import { useAuth } from "../context/AuthContext";
import { Heart, MessageSquare, Share2, Send, Eye } from "lucide-react";
import ShareSheet from "../components/shared/ShareSheet";

import { Pencil, Trash2, Save, X } from "lucide-react";
import ConfirmDeleteDialog from "../components/ui/ConfirmDeleteDialog";
import UserAvatar from "../components/shared/UserAvatar";

// shadcn toast
import { useToast } from "../hooks/use-toast";
import { ToastAction } from "../components/ui/toast";

function AuthorHandle({ username }) {
  if (username) return <span className="font-medium">@{username}</span>;
  return <span className="select-none blur-[3px]">@private_user</span>;
}
const ONLINE_WINDOW_MS = 2 * 60 * 1000;
const isOnline = (ts) => (ts ? Date.now() - new Date(ts).getTime() < ONLINE_WINDOW_MS : false);


export default function FeedPostDetails() {


  const { id } = useParams();
  const { user, openAuthModal,isAdmin } = useAuth();
  const { toast } = useToast();

  const actionBtn =
  "flex w-full items-center justify-center gap-2 px-3 py-3 text-sm transition hover:bg-muted/20";

  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState(null);
  const [error, setError] = useState("");

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);

  const commentInputRef = useRef(null);



const [editingId, setEditingId] = useState("");
const [editingText, setEditingText] = useState("");
const [editLoading, setEditLoading] = useState(false);

const [deleteOpen, setDeleteOpen] = useState(false);
const [deleteLoading, setDeleteLoading] = useState(false);
const [commentToDelete, setCommentToDelete] = useState(null);

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

  function startEdit(c) {
  setEditingId(c.id);
  setEditingText(c.body || "");
}

function cancelEdit() {
  setEditingId("");
  setEditingText("");
}

async function saveEdit() {
  if (!user) return needLoginToast();
  if (!editingId) return;

  const text = editingText.trim();
  if (!text) {
    toast({ title: "Comment is empty", description: "Type something first." });
    return;
  }

  setEditLoading(true);
  try {
    const res = await feedService.editComment(editingId, text);

    setPost((p) =>
      !p
        ? p
        : {
            ...p,
            comments: (p.comments ?? []).map((c) => (c.id === editingId ? res.comment : c)),
          }
    );

    cancelEdit();
  } catch (e) {
    toast({
      title: "Could not edit comment",
      description: e?.response?.data?.message || e.message || "Try again.",
    });
  } finally {
    setEditLoading(false);
  }
}

async function removeCommentConfirmed() {
  if (!user) return needLoginToast();
  if (!commentToDelete?.id) return;

  setDeleteLoading(true);
  try {
    const res = await feedService.deleteComment(commentToDelete.id);

    setPost((p) => {
      if (!p) return p;
      return {
        ...p,
        likeCount: res.likeCount ?? p.likeCount,
        commentCount: res.commentCount ?? p.commentCount,
        comments: (p.comments ?? []).filter((c) => c.id !== commentToDelete.id),
      };
    });

    setDeleteOpen(false);
    setCommentToDelete(null);
  } catch (e) {
    toast({
      title: "Could not delete comment",
      description: e?.response?.data?.message || e.message || "Try again.",
    });
  } finally {
    setDeleteLoading(false);
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
         <div className="relative w-full overflow-hidden rounded-xl border border-border/60 bg-muted aspect-[16/10] sm:aspect-[16/9]">
            <img
    src={post.image}
    alt=""
    aria-hidden="true"
    className="absolute inset-0 h-full w-full object-cover blur-2xl scale-110 opacity-40"
    loading="lazy"
  />
    <img
    src={post.image}
    alt={post.title}
    className="relative z-10 h-full w-full object-cover"
    loading="lazy"
  />
   <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/10 via-transparent to-transparent" />
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


            {/* Body */}
            <div className="whitespace-pre-wrap break-words text-sm text-muted-foreground leading-6">
              {post.body}
            </div>

            
            {/* Action bar (Like | Comment | Share) */}


<div className="grid grid-cols-4 overflow-hidden rounded-xl border border-border/60 bg-muted/10">
  {/* Like */}
  <button
    type="button"
    className={actionBtn}
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

  {/* Comment */}
  <button
    type="button"
    className={`${actionBtn} border-x border-border/60`}
    onClick={onOpenComments}
  >
    <MessageSquare className="h-4 w-4 text-muted-foreground" />
    <span className="font-medium">{post.commentCount ?? 0}</span>
  </button>

  {/* Views (Binance-style) */}
<div className={`${actionBtn} border-r border-border/60 cursor-default`} title="Views">
  <Eye className="h-4 w-4 text-muted-foreground" />
  <div className="leading-tight">
    <div className="font-medium">{post.viewCount ?? 0} Views</div>
    
  </div>
</div>

  {/* Share (keep your ShareSheet) */}
  <ShareSheet url={shareUrl} title={post.title} text={(post.body || "").slice(0, 120)}>
    <button type="button" className={actionBtn}>
      <Share2 className="h-4 w-4 text-muted-foreground" />
      <span className="font-medium">Share</span>
    </button>
  </ShareSheet>
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
                    
                  (post.comments ?? []).map((c) => {
  const isMine = Boolean(user && c.authorId === user.uid);
  const canEdit = isMine;
  const canDelete = isMine || Boolean(isAdmin);

  const isEditing = editingId === c.id;

  return (
    <div key={c.id} className="rounded-xl border border-border/60 bg-muted/10 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
        <div className="flex items-center gap-2">
  <UserAvatar
    src={c.author?.avatarUrl}
    alt={c.author?.username ? `@${c.author.username}` : "User"}
    size={32}
     online={isOnline(c.author?.lastActiveAt)}
  />
  <AuthorHandle username={c.author?.username} />
</div>
          <div className="text-xs text-muted-foreground">
            {c.createdAt ? new Date(c.createdAt).toLocaleString() : ""}
          </div>
        </div>

        {(canEdit || canDelete) ? (
          <div className="flex items-center gap-1">
            {canEdit ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => (isEditing ? cancelEdit() : startEdit(c))}
                disabled={editLoading}
                title="Edit"
              >
                {isEditing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              </Button>
            ) : null}

            {canDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCommentToDelete(c);
                  setDeleteOpen(true);
                }}
                disabled={deleteLoading}
                title={isAdmin && !isMine ? "Admin delete" : "Delete"}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {isEditing ? (
        <div className="mt-3 space-y-2">
          <Textarea
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            disabled={editLoading}
            className="min-h-[80px]"
          />
          <div className="flex gap-2">
            <Button onClick={saveEdit} disabled={editLoading} className="gap-2">
              <Save className="h-4 w-4" />
              {editLoading ? "Saving..." : "Save"}
            </Button>
            <Button variant="outline" onClick={cancelEdit} disabled={editLoading}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
          {c.body}
        </div>
      )}
    </div>
  );
})


                  )}
                </div>

                {/* composer (chat-like) */}
                <div className="mt-3 rounded-2xl border border-border/60 bg-card/60 p-3">
  <div className="flex items-end gap-2">
    <Textarea
      ref={commentInputRef}
      placeholder={user ? "Write a comment…" : "Login to comment…"}
      value={commentText}
      onChange={(e) => setCommentText(e.target.value)}
      disabled={!user || commentLoading}
      rows={2}
      className="min-h-[44px] resize-none rounded-2xl bg-muted/20"
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onAddComment();
        }
      }}
    />

    <Button
      type="button"
      size="icon"
      className="h-11 w-11 shrink-0 rounded-full"
      disabled={!user || commentLoading}
      onClick={onAddComment}
      aria-label="Send comment"
      title="Send"
    >
      <Send className="h-5 w-5" />
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

        <ConfirmDeleteDialog
  open={deleteOpen}
  onOpenChange={(o) => {
    setDeleteOpen(o);
    if (!o) setCommentToDelete(null);
  }}
  loading={deleteLoading}
  title="Delete this comment?"
  description="This action cannot be undone."
  confirmText="Delete comment"
  onConfirm={removeCommentConfirmed}
/>
      </div>
    </PageContainer>
  );
}