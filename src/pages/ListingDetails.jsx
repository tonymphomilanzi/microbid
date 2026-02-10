import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "../components/ui/drawer";
import { useAuth } from "../context/AuthContext";
import { listingsService } from "../services/listings.service";
import { MessageCircle, CreditCard, BadgeCheck, Heart, MessageSquare, Share2, Send } from "lucide-react";
import ChatDialog from "../components/chat/ChatDialog";
import ShareSheet from "../components/shared/ShareSheet";
import { useToast } from "../hooks/use-toast";
import { ToastAction } from "../components/ui/toast";
import UserAvatar from "../components/shared/UserAvatar";

function SellerHandle({ username }) {
  if (username) return <span className="truncate text-sm font-medium">@{username}</span>;
  return (
    <span className="truncate text-sm font-medium select-none blur-[3px]" title="Seller username not set">
      @private_seller
    </span>
  );
}

function CommentAuthor({ username }) {
  if (username) return <span className="font-medium">@{username}</span>;
  return <span className="select-none blur-[3px]">@private_user</span>;
}

export default function ListingDetails() {
  const { id } = useParams();
  const { user, authReady, openAuthModal } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState(null);
  const [error, setError] = useState("");

  const [chatOpen, setChatOpen] = useState(false);

  // Gallery state
  const [activeImage, setActiveImage] = useState("");

  // Social state (detail page)
  const [likedByMe, setLikedByMe] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);

  // Comments drawer
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [commentSending, setCommentSending] = useState(false);
  const commentRef = useRef(null);

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

  useEffect(() => {
    let mounted = true;

    async function run() {
      if (!authReady) return; // ✅ wait for firebase session restore
      setLoading(true);
      setError("");
      setListing(null);

      try {
        const { listing } = await listingsService.getListing(id);
        if (!mounted) return;

        setListing(listing);

        // gallery
        const gallery = [listing?.image, ...(listing?.images ?? [])].filter(Boolean);
        const unique = Array.from(new Set(gallery)).slice(0, 7);
        setActiveImage(unique[0] || "");

        // social
        setLikedByMe(Boolean(listing?.likedByMe));
        setLikeCount(Number(listing?.likeCount ?? 0));
        setCommentCount(Number(listing?.commentCount ?? 0));
      } catch (e) {
        const msg = e?.response?.data?.message || e.message || "Failed to load listing";
        if (mounted) setError(msg);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (id) run();
    return () => (mounted = false);
  }, [id, authReady, user?.uid]);

  const images = useMemo(() => {
    if (!listing) return [];
    const gallery = [listing?.image, ...(listing?.images ?? [])].filter(Boolean);
    return Array.from(new Set(gallery)).slice(0, 7);
  }, [listing]);

  const shareUrl = useMemo(() => `${window.location.origin}/listings/${id}`, [id]);

  async function onToggleLike() {
    if (!user) return needLoginToast();

    // optimistic
    const next = !likedByMe;
    setLikedByMe(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));

    try {
      const res = await listingsService.toggleListingLike(id);
      setLikedByMe(Boolean(res.liked));
      setLikeCount(Number(res.likeCount ?? 0));
      setCommentCount(Number(res.commentCount ?? commentCount));
    } catch (e) {
      toast({
        title: "Could not like listing",
        description: e?.response?.data?.message || e.message || "Try again.",
      });
      // easiest: refetch listing state
      const { listing } = await listingsService.getListing(id);
      setLikedByMe(Boolean(listing?.likedByMe));
      setLikeCount(Number(listing?.likeCount ?? 0));
      setCommentCount(Number(listing?.commentCount ?? 0));
    }
  }

  async function openComments() {
    setCommentsOpen(true);
    setCommentsLoading(true);
    try {
      const res = await listingsService.listListingComments(id);
      setComments(res.comments ?? []);
      setCommentCount(Number(res.commentCount ?? (res.comments?.length ?? commentCount)));
    } catch (e) {
      toast({
        title: "Could not load comments",
        description: e?.response?.data?.message || e.message || "Try again.",
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
      const res = await listingsService.addListingComment(id, text);
      setComments((prev) => [res.comment, ...prev]);
      setCommentCount(Number(res.commentCount ?? (commentCount + 1)));
      setLikeCount(Number(res.likeCount ?? likeCount));
      setCommentText("");
      setTimeout(() => commentRef.current?.focus(), 0);
    } catch (e) {
      toast({
        title: "Could not comment",
        description: e?.response?.data?.message || e.message || "Try again.",
      });
    } finally {
      setCommentSending(false);
    }
  }

  async function buy() {
    try {
      if (!user) return openAuthModal();
      const { checkoutUrl } = await listingsService.checkout(id);
      window.location.href = checkoutUrl;
    } catch (e) {
      alert(e?.response?.data?.message || e.message || "Checkout failed");
    }
  }

  function chat() {
    if (!user) return openAuthModal();
    setChatOpen(true);
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="py-10 text-sm text-muted-foreground">Loading...</div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <div className="py-10 space-y-2">
          <div className="text-sm font-medium">Could not load listing</div>
          <div className="text-sm text-destructive">{error}</div>
        </div>
      </PageContainer>
    );
  }

  if (!listing) {
    return (
      <PageContainer>
        <div className="py-10 text-sm text-muted-foreground">Listing not found.</div>
      </PageContainer>
    );
  }

  const m = listing.metrics || {};
  const isOwner = Boolean(user && listing?.sellerId === user.uid);
  const verified = Boolean(listing?.seller?.isVerified);
  const username = listing?.seller?.username || "";

  return (
    <PageContainer>
      <div className="py-8 space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Gallery */}
          <div className="space-y-3">
            <div className="relative w-full overflow-hidden rounded-xl border border-border/60 bg-muted aspect-[16/10] sm:aspect-[16/9]">
              <img
                src={activeImage || listing.image}
                alt={listing.title}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>

            {images.length > 1 ? (
              <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-2 sm:overflow-x-auto sm:pb-1 sm:[-ms-overflow-style:none] sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden">
                {images.map((src) => {
                  const selected = src === activeImage;
                  return (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setActiveImage(src)}
                      className={[
                        "relative overflow-hidden rounded-lg border transition",
                        "aspect-[4/3] w-full",
                        "sm:h-16 sm:w-24 sm:shrink-0 sm:aspect-auto",
                        selected
                          ? "border-primary/40 ring-2 ring-primary/20"
                          : "border-border/60 hover:border-primary/20",
                      ].join(" ")}
                      title="View image"
                    >
                      <img src={src} alt="Listing thumbnail" className="h-full w-full object-cover" />
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* Right: Details */}
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-2xl font-semibold tracking-tight">{listing.title}</h1>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{listing.platform}</Badge>
                {listing.category?.name ? <Badge variant="outline">{listing.category.name}</Badge> : null}
              </div>
            </div>

            <div className="text-sm text-muted-foreground whitespace-pre-wrap break-words leading-6">
              {listing.description}
            </div>

            {/* price + seller */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="border-border/60 bg-card/60">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Price</div>
                  <div className="text-lg font-semibold">${listing.price}</div>
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-card/60">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Seller</div>
                  <div className="mt-1 flex items-center gap-2 min-w-0">
                    <SellerHandle username={username} />
                    {verified ? (
                      <span className="inline-flex items-center gap-1 text-xs text-primary" title="Verified seller">
                        <BadgeCheck className="h-4 w-4" />
                        Verified
                      </span>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* metrics */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="border-border/60 bg-card/60">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Followers/Subs</div>
                  <div className="text-base font-semibold">{m.followers ?? "—"}</div>
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-card/60">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Avg Views</div>
                  <div className="text-base font-semibold">{m.avgViews ?? "—"}</div>
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-card/60">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Engagement</div>
                  <div className="text-base font-semibold">
                    {m.engagementRate ? `${m.engagementRate}%` : "—"}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-card/60">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Monetized</div>
                  <div className="text-base font-semibold">
                    {typeof m.monetized === "boolean" ? (m.monetized ? "Yes" : "No") : "—"}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ✅ Like | Comment | Share BEFORE Buy/Message */}
            <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-border/60 bg-muted/10">
              <button type="button" className={actionBtn} onClick={onToggleLike}>
                <Heart
                  className={[
                    "h-4 w-4",
                    likedByMe ? "fill-primary text-primary" : "text-muted-foreground",
                  ].join(" ")}
                />
                <span className="font-medium">{likeCount}</span>
              </button>

              <button
                type="button"
                className={`${actionBtn} border-x border-border/60`}
                onClick={openComments}
              >
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{commentCount}</span>
              </button>

              <ShareSheet url={shareUrl} title={listing.title} text={(listing.description || "").slice(0, 120)}>
                <button type="button" className={actionBtn}>
                  <Share2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Share</span>
                </button>
              </ShareSheet>
            </div>

            {/* Buy + Message */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={buy} className="gap-2">
                <CreditCard className="h-4 w-4" />
                Buy with Stripe
              </Button>

              <Button
                variant="outline"
                onClick={chat}
                className="gap-2"
                disabled={isOwner}
                title={isOwner ? "You cannot message your own listing" : "Message seller"}
              >
                <MessageCircle className="h-4 w-4" />
                {isOwner ? "Your listing" : "Message Seller"}
              </Button>
            </div>
          </div>
        </div>

        <ChatDialog open={chatOpen} onOpenChange={setChatOpen} currentUser={user} listing={listing} />

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
                            <UserAvatar
                               src={c.author?.avatarUrl}
                               alt={c.author?.username ? `@${c.author.username}` : "User"}
                               size={32}
                             />
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

                {/* composer */}
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
      </div>
    </PageContainer>
  );
}