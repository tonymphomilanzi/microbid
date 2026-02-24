// src/pages/Messages.jsx
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { chatService } from "../services/chat.service";
import { CheckCheck, MessageCircle, RefreshCw } from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { useAuth } from "../context/AuthContext";
import ChatDialog from "../components/chat/ChatDialog";

function timeAgo(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function SkeletonRow() {
  return (
    <div className="p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-muted animate-pulse shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-1/3 rounded bg-muted animate-pulse" />
          <div className="h-3 w-2/3 rounded bg-muted/80 animate-pulse" />
          <div className="h-3 w-full rounded bg-muted/70 animate-pulse" />
          <div className="h-3 w-1/4 rounded bg-muted/60 animate-pulse" />
        </div>
        <div className="h-12 w-16 rounded-lg bg-muted animate-pulse shrink-0" />
      </div>
    </div>
  );
}

export default function Messages() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [sp] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState("");

  // Chat dialog state
  const [activeConvoId, setActiveConvoId] = useState("");
  const [chatOpen, setChatOpen] = useState(false);

  const unreadCount = useMemo(() => {
    return conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  }, [conversations]);

  const hasUnread = unreadCount > 0;

  async function loadConversations() {
    setLoading(true);
    setError("");
    try {
      const res = await chatService.list();
      setConversations(res.conversations || []);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to load messages");
      toast({
        title: "Failed to load messages",
        description: e?.response?.data?.message || e.message || "Try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConversations();

    // Check if there's a conversation ID in URL params
    const convoId = sp.get("conversation");
    if (convoId) {
      setActiveConvoId(convoId);
      setChatOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openConversation(convo) {
    setActiveConvoId(convo.id);
    setChatOpen(true);
  }

  async function markAllRead() {
    try {
      // If your chatService has a markAllRead method
      if (chatService.markAllRead) {
        await chatService.markAllRead();
      }
      setConversations((prev) =>
        prev.map((c) => ({ ...c, unreadCount: 0 }))
      );
      toast({ title: "All read", description: "Messages marked as read." });
    } catch (e) {
      toast({
        title: "Failed",
        description: e?.response?.data?.message || e.message || "Try again.",
      });
    }
  }

  const defaultAvatar = "/avatar-default.png";

  return (
    <PageContainer>
      <div className="py-8">
        <div className="mx-auto max-w-3xl space-y-5">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                <span className="bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
                  Messages
                </span>
              </h1>
              <p className="text-sm text-muted-foreground">
                Your conversations with buyers and sellers.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="secondary"
                className="rounded-full px-3 py-1 text-xs font-medium"
              >
                Unread{" "}
                <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-background/70 px-1.5 text-[11px] text-foreground ring-1 ring-border/60">
                  {unreadCount}
                </span>
              </Badge>

              <Button
                variant="outline"
                size="icon"
                className="rounded-full border-border/60 bg-background/60 backdrop-blur hover:bg-muted/40"
                onClick={loadConversations}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>

              <Button
                variant="outline"
                className="rounded-full gap-2 border-border/60 bg-background/60 backdrop-blur hover:bg-muted/40"
                disabled={!hasUnread}
                onClick={markAllRead}
              >
                <CheckCheck className="h-4 w-4" />
                Mark all read
              </Button>
            </div>
          </div>

          {/* List */}
          <Card className="border-border/60 bg-background/40 shadow-sm ring-1 ring-border/30">
            <CardContent className="p-0">
              {loading ? (
                <div className="divide-y divide-border/60">
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </div>
              ) : error ? (
                <div className="p-10 text-center">
                  <div className="mx-auto mb-2 h-10 w-10 rounded-2xl bg-destructive/10 ring-1 ring-destructive/20 grid place-items-center">
                    <MessageCircle className="h-5 w-5 text-destructive" />
                  </div>
                  <div className="text-sm font-medium">Could not load messages</div>
                  <div className="mt-1 text-sm text-muted-foreground">{error}</div>
                  <div className="mt-4">
                    <Button variant="outline" onClick={loadConversations}>
                      Retry
                    </Button>
                  </div>
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="mx-auto mb-2 h-10 w-10 rounded-2xl bg-muted/40 ring-1 ring-border/60 grid place-items-center">
                    <MessageCircle className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="text-sm font-medium">No conversations</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Start a conversation by messaging a seller on the marketplace.
                  </div>
                </div>
              ) : (
                <div className="p-2 sm:p-3 space-y-2">
                  {conversations.map((c) => {
                    const lastText = c.messages?.[0]?.text ?? "No messages yet";
                    const otherUser = c.buyerId === user?.id ? c.seller : c.buyer;
                    const otherUsername = otherUser?.username || "";
                    const otherAvatar = otherUser?.avatarUrl;

                    const initials = otherUsername
                      ? otherUsername.slice(0, 2).toUpperCase()
                      : "U";
                    const unread = (c.unreadCount || 0) > 0;

                    const ts = c.lastMessageAt || c.updatedAt;

                    return (
                      <button
                        key={c.id}
                        onClick={() => openConversation(c)}
                        className={[
                          "group w-full text-left rounded-xl border transition",
                          "border-border/60 bg-background/60 hover:bg-muted/30",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                          unread ? "ring-1 ring-primary/20 bg-primary/[0.06]" : "",
                        ].join(" ")}
                      >
                        <div className="p-4 sm:p-5">
                          <div className="flex items-start gap-3">
                            {/* Avatar */}
                            {otherAvatar ? (
                              <img
                                src={otherAvatar}
                                alt=""
                                className={[
                                  "mt-0.5 h-10 w-10 shrink-0 rounded-full object-cover border",
                                  unread ? "border-primary/30" : "border-border/60",
                                ].join(" ")}
                                onError={(e) => {
                                  e.currentTarget.src = defaultAvatar;
                                }}
                              />
                            ) : (
                              <div
                                className={[
                                  "mt-0.5 h-10 w-10 shrink-0 rounded-full grid place-items-center border text-sm font-semibold",
                                  unread
                                    ? "border-primary/30 bg-primary/15 text-primary"
                                    : "border-border/60 bg-muted/20 text-muted-foreground",
                                ].join(" ")}
                              >
                                {initials}
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <div
                                  className={[
                                    "truncate",
                                    unread ? "font-semibold" : "font-medium",
                                  ].join(" ")}
                                >
                                  {otherUsername ? (
                                    `@${otherUsername}`
                                  ) : (
                                    <span className="select-none blur-[3px]">
                                      @private_user
                                    </span>
                                  )}
                                </div>

                                {unread ? (
                                  <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                                    {c.unreadCount} new
                                  </span>
                                ) : null}
                              </div>

                              {/* Listing info */}
                              <div className="mt-1 flex items-center gap-2">
                                {c.listing?.platform ? (
                                  <Badge
                                    variant="outline"
                                    className="rounded-full border-border/60 bg-muted/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                                  >
                                    {c.listing.platform}
                                  </Badge>
                                ) : null}
                                <span className="truncate text-xs text-muted-foreground">
                                  {c.listing?.title || "Listing"}
                                </span>
                              </div>

                              {/* Last message */}
                              <div
                                className={[
                                  "mt-2 text-sm line-clamp-1",
                                  unread ? "text-foreground" : "text-muted-foreground",
                                ].join(" ")}
                              >
                                {lastText}
                              </div>

                              <div className="mt-2 text-xs text-muted-foreground">
                                {timeAgo(ts)}
                              </div>
                            </div>

                            {/* Listing thumbnail */}
                            {c.listing?.image ? (
                              <div className="shrink-0">
                                <img
                                  src={c.listing.image}
                                  alt=""
                                  className="h-12 w-16 rounded-lg object-cover border border-border/60"
                                />
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Hint */}
          {!loading && hasUnread ? (
            <p className="text-xs text-muted-foreground">
              Tip: unread conversations are highlighted.
            </p>
          ) : null}
        </div>
      </div>

      {/* Chat Dialog */}
      <ChatDialog
        open={chatOpen}
        onOpenChange={(o) => {
          setChatOpen(o);
          if (!o) {
            setActiveConvoId("");
            loadConversations(); // Refresh to update unread counts
          }
        }}
        currentUser={user ? { uid: user.id } : null}
        conversationId={activeConvoId || undefined}
      />
    </PageContainer>
  );
}