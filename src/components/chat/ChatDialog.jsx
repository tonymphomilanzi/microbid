import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { chatService } from "../../services/chat.service";

export default function ChatDialog({
  open,
  onOpenChange,
  currentUser,
  listing,        // optional (buyer starts chat from listing)
  conversationId, // optional (open from inbox)
}) {
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const bottomRef = useRef(null);

  const contextOk = Boolean(conversationId || listing?.id);

  const headerListing = useMemo(() => {
    // Prefer conversation listing once loaded, else fallback to listing prop
    return conversation?.listing ?? listing ?? null;
  }, [conversation, listing]);

  const otherParty = useMemo(() => {
    if (!conversation || !currentUser) return "";
    const isBuyer = conversation.buyerId === currentUser.uid;
    return isBuyer ? conversation.seller?.email : conversation.buyer?.email;
  }, [conversation, currentUser]);

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  async function refresh({ silent = false } = {}) {
    if (!contextOk) return;

    setError("");
    if (silent) setRefreshing(true);
    else setInitialLoading(true);

    try {
      if (conversationId) {
        const { conversation } = await chatService.getConversation(conversationId);
        setConversation(conversation);
      } else if (listing?.id) {
        const { conversation } = await chatService.getByListing(listing.id);
        setConversation(conversation); // can be null until first message
      }
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to load chat");
    } finally {
      if (silent) setRefreshing(false);
      else setInitialLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;

    // reset basic UI each open
    setText("");
    setError("");
    setConversation(null);
    setInitialLoading(true);

    refresh({ silent: false });

    const t = setInterval(() => refresh({ silent: true }), 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, conversationId, listing?.id]);

  useEffect(() => {
    if (!open) return;
    // scroll when messages change
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.messages?.length, open]);

  async function send() {
    if (!currentUser) {
      setError("Please login to send messages.");
      return;
    }
    if (!contextOk) {
      setError("Chat context missing.");
      return;
    }
    if (!text.trim()) return;

    setError("");
    try {
      if (conversationId) {
        await chatService.sendToConversation({ id: conversationId, text: text.trim() });
      } else if (listing?.id) {
        await chatService.openOrSendToListing({ listingId: listing.id, text: text.trim() });
      }
      setText("");
      await refresh({ silent: false });
      scrollToBottom();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to send");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <span className="truncate">
              {otherParty ? `Chat • ${otherParty}` : "Chat"}
            </span>
            {refreshing ? (
              <span className="text-xs text-muted-foreground">syncing…</span>
            ) : null}
          </DialogTitle>

          {headerListing ? (
            <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{headerListing.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {headerListing.platform ? (
                    <Badge variant="outline">{headerListing.platform}</Badge>
                  ) : null}
                </div>
              </div>
              {headerListing.image ? (
                <img
                  src={headerListing.image}
                  alt="Listing"
                  className="h-10 w-16 rounded-md object-cover border border-border/60"
                />
              ) : null}
            </div>
          ) : null}
        </DialogHeader>

        {!contextOk ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            Chat context missing (no conversationId and no listing).
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="h-[360px] overflow-y-auto rounded-lg border border-border/60 bg-muted/10 p-3">
          {initialLoading ? (
            <div className="text-sm text-muted-foreground">Loading messages...</div>
          ) : !conversation?.messages?.length ? (
            <div className="text-sm text-muted-foreground">
              No messages yet. Send the first message.
            </div>
          ) : (
            <div className="space-y-2">
              {conversation.messages.map((m) => {
                const mine = m.senderId === currentUser?.uid;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                        mine
                          ? "bg-primary text-primary-foreground"
                          : "bg-card text-card-foreground border border-border/60"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Type a message…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            disabled={!contextOk || initialLoading}
          />
          <Button onClick={send} disabled={!contextOk || initialLoading}>
            Send
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}