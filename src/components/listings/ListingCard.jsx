import { useMemo, useRef, useState,useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { DollarSign, Image as ImageIcon, BadgeCheck, Heart, MessageSquare, Share2, Send } from "lucide-react";
import ShareSheet from "../shared/ShareSheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "../ui/drawer";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { listingsService } from "../../services/listings.service";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../hooks/use-toast";
import { ToastAction } from "../ui/toast";

const platformClasses = (p) => {
  if (p === "YouTube") return "bg-red-500/10 text-red-300 border-red-500/20";
  if (p === "Instagram") return "bg-pink-500/10 text-pink-300 border-pink-500/20";
  if (p === "TikTok") return "bg-zinc-500/10 text-zinc-200 border-zinc-500/20";
  if (p === "Telegram") return "bg-sky-500/10 text-sky-300 border-sky-500/20";
  return "bg-blue-500/10 text-blue-300 border-blue-500/20";
};

function initialsFromUsername(username) {
  if (!username) return "U";
  return username.slice(0, 2).toUpperCase();
}

function SellerHandle({ username }) {
  if (username) return <span className="truncate text-sm text-muted-foreground">@{username}</span>;
  return (
    <span className="truncate text-sm text-muted-foreground select-none blur-[3px]">
      @private_seller
    </span>
  );
}

function CommentAuthor({ username }) {
  if (username) return <span className="font-medium">@{username}</span>;
  return <span className="select-none blur-[3px]">@private_user</span>;
}

export default function ListingCard({ listing }) {
  const navigate = useNavigate();
  const { user, openAuthModal } = useAuth();
  const { toast } = useToast();

  const verified = Boolean(listing?.seller?.isVerified);
  const username = listing?.seller?.username || "";
  const categoryName = listing?.category?.name;

  const [likedByMe, setLikedByMe] = useState(Boolean(listing?.likedByMe));
  const [likeCount, setLikeCount] = useState(Number(listing?.likeCount ?? 0));
  const [commentCount, setCommentCount] = useState(Number(listing?.commentCount ?? 0));

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [commentSending, setCommentSending] = useState(false);
  const commentRef = useRef(null);

  const shareUrl = useMemo(() => `${window.location.origin}/listings/${listing.id}`, [listing.id]);

  const actionBtn =
    "flex w-full items-center justify-center gap-2 px-3 py-3 text-sm transition hover:bg-muted/20";

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

  async function onToggleLike(e) {
    e.stopPropagation();
    if (!user) return needLoginToast();

    const nextLiked = !likedByMe;
    setLikedByMe(nextLiked);
    setLikeCount((c) => Math.max(0, c + (nextLiked ? 1 : -1)));

    try {
      const res = await listingsService.toggleListingLike(listing.id);
      setLikedByMe(res.liked);
      setLikeCount(res.likeCount ?? 0);
      setCommentCount(res.commentCount ?? commentCount);
    } catch (err) {
      toast({
        title: "Could not like",
        description: err?.response?.data?.message || err.message || "Try again.",
      });
    }
  }

  async function openComments(e) {
    e.stopPropagation();
    setCommentsOpen(true);

    setCommentsLoading(true);
    try {
      const res = await listingsService.listListingComments(listing.id);
      setComments(res.comments ?? []);
      setCommentCount(res.commentCount ?? (res.comments?.length ?? commentCount));
    } catch (err) {
      toast({
        title: "Could not load comments",
        description: err?.response?.data?.message || err.message || "Try again.",
      });
    } finally {
      setCommentsLoading(false);
      setTimeout(() => commentRef.current?.focus(), 120);
    }
  }

  async function sendComment() {
    if (!user) return needLoginToast();

    const text = commentText.trim();
    if (!text) return;

    setCommentSending(true);
    try {
      const res = await listingsService.addListingComment(listing.id, text);
      setComments((prev) => [res.comment, ...prev]);
      setCommentCount(res.commentCount ?? (commentCount + 1));
      setLikeCount(res.likeCount ?? likeCount);
      setCommentText("");
      setTimeout(() => commentRef.current?.focus(), 0);
    } catch (err) {
      toast({
        title: "Could not comment",
        description: err?.response?.data?.message || err.message || "Try again.",
      });
    } finally {
      setCommentSending(false);
    }
  }


  useEffect(() => {
  setLikedByMe(Boolean(listing?.likedByMe));
  setLikeCount(Number(listing?.likeCount ?? 0));
  setCommentCount(Number(listing?.commentCount ?? 0));
}, [listing?.id, listing?.likedByMe, listing?.likeCount, listing?.commentCount]);


  return (
    <>
      <Card
        className="group cursor-pointer overflow-hidden rounded-2xl border-border/60 bg-card/60 backdrop-blur
                   transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5 hover:border-primary/25"
        onClick={() => navigate(`/listings/${listing.id}`)}
        role="button"
      >
        {/* Image */}
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
          {listing.image ? (
            <img
              src={listing.image}
              alt={listing.title}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <ImageIcon className="h-6 w-6" />
            </div>
          )}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/70 via-background/10 to-transparent" />

          <div className="absolute left-3 top-3">
            <Badge variant="outline" className={platformClasses(listing.platform)}>
              {listing.platform}
            </Badge>
          </div>

          <div className="absolute right-3 top-3 flex items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-sm font-semibold backdrop-blur">
              <DollarSign className="h-4 w-4 text-primary" />
              <span>{listing.price}</span>
            </div>
          </div>

          {categoryName ? (
            <div className="absolute bottom-3 left-3">
              <Badge variant="outline" className="border-border/60 bg-background/60 backdrop-blur">
                {categoryName}
              </Badge>
            </div>
          ) : null}
        </div>

        <CardContent className="space-y-3 p-4">
          <h3 className="line-clamp-2 text-sm font-semibold tracking-tight">{listing.title}</h3>

          {/* Seller row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <div
                className={[
                  "grid h-9 w-9 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                  verified
                    ? "border-primary/25 bg-primary/10 text-primary"
                    : "border-border/60 bg-muted/20 text-muted-foreground",
                ].join(" ")}
              >
                {initialsFromUsername(username)}
              </div>

              <div className="min-w-0 flex items-center gap-1">
                <SellerHandle username={username} />
                {verified ? (
                  <span className="inline-flex items-center gap-1 text-xs text-primary" title="Verified seller">
                    <BadgeCheck className="h-4 w-4" />
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Like | Comment | Share */}
          <div
            className="grid grid-cols-3 overflow-hidden rounded-xl border border-border/60 bg-muted/10"
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className={actionBtn} onClick={onToggleLike}>
              <Heart className={["h-4 w-4", likedByMe ? "fill-primary text-primary" : "text-muted-foreground"].join(" ")} />
              <span className="font-medium">{likeCount}</span>
            </button>

            <button type="button" className={`${actionBtn} border-x border-border/60`} onClick={openComments}>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{commentCount}</span>
            </button>

            <ShareSheet url={shareUrl} title={listing.title} text={(listing.description || "").slice(0, 120)}>
              <button type="button" className={actionBtn} onClick={(e) => e.stopPropagation()}>
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
              <div className="text-xs text-muted-foreground">{commentCount} total</div>
            </DrawerHeader>

            <div className="flex h-[70vh] flex-col">
              <div className="flex-1 overflow-auto pr-1 space-y-3">
                {commentsLoading ? (
                  <div className="text-sm text-muted-foreground">Loading comments…</div>
                ) : comments.length === 0 ? (
                  <div className="rounded-xl border border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground">
                    No comments yet. Be the first.
                  </div>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="rounded-xl border border-border/60 bg-muted/10 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm">
                          <CommentAuthor username={c.author?.username} />
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

              {/* WhatsApp-style composer */}
              <div className="mt-3 rounded-2xl border border-border/60 bg-card/60 p-3">
                <div className="flex items-end gap-2">
                  <Textarea
                    ref={commentRef}
                    placeholder={user ? "Write a comment…" : "Login to comment…"}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    disabled={!user || commentSending}
                    rows={2}
                    className="min-h-[44px] resize-none rounded-2xl bg-muted/20"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendComment();
                      }
                    }}
                  />

                  <Button
                    type="button"
                    size="icon"
                    className="h-11 w-11 shrink-0 rounded-full"
                    disabled={!user || commentSending}
                    onClick={sendComment}
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
    </>
  );
}