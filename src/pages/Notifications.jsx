import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { listingsService } from "../services/listings.service";
import { CheckCheck, ChevronDown } from "lucide-react";
import { useToast } from "../hooks/use-toast";

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

export default function Notifications() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const hasUnread = unreadCount > 0;

  async function loadFirst() {
    setLoading(true);
    try {
      const res = await listingsService.getNotifications();
      setItems(res.notifications ?? []);
      setUnreadCount(Number(res.unreadCount ?? 0));
      setNextCursor(res.nextCursor ?? null);
    } catch (e) {
      toast({
        title: "Failed to load notifications",
        description: e?.response?.data?.message || e.message || "Try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await listingsService.getNotifications({ cursor: nextCursor });
      setItems((prev) => [...prev, ...(res.notifications ?? [])]);
      setUnreadCount(Number(res.unreadCount ?? unreadCount));
      setNextCursor(res.nextCursor ?? null);
    } catch (e) {
      toast({
        title: "Failed to load more",
        description: e?.response?.data?.message || e.message || "Try again.",
      });
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    loadFirst();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unreadIds = useMemo(() => items.filter((n) => !n.isRead).map((n) => n.id), [items]);

  async function markAllRead() {
    try {
      await listingsService.markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast({ title: "All read", description: "Notifications marked as read." });
    } catch (e) {
      toast({
        title: "Failed",
        description: e?.response?.data?.message || e.message || "Try again.",
      });
    }
  }

  async function openNotification(n) {
    // mark read (best-effort)
    if (!n.isRead) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
      listingsService.markNotificationsRead([n.id]).catch(() => {});
    }

    if (n.url) navigate(n.url);
  }

  return (
    <PageContainer>
      <div className="py-8 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
            <p className="text-sm text-muted-foreground">
              Updates about bids, purchases, sales, and escrow.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-border/60 bg-muted/20">
              Unread: {unreadCount}
            </Badge>
            <Button variant="outline" className="gap-2" disabled={!hasUnread} onClick={markAllRead}>
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          </div>
        </div>

        <Card className="border-border/60 bg-card/60">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 text-sm text-muted-foreground">Loading…</div>
            ) : items.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No notifications yet.</div>
            ) : (
              <div className="divide-y divide-border/60">
                {items.map((n) => (
                  <button
                    key={n.id}
                    className={[
                      "w-full text-left p-4 transition hover:bg-muted/20",
                      !n.isRead ? "bg-primary/5" : "",
                    ].join(" ")}
                    onClick={() => openNotification(n)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-medium truncate">{n.title}</div>
                          {!n.isRead ? (
                            <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] text-primary-foreground">
                              New
                            </span>
                          ) : null}
                        </div>

                        {n.body ? (
                          <div className="mt-1 text-sm text-muted-foreground line-clamp-2">
                            {n.body}
                          </div>
                        ) : null}

                        <div className="mt-2 text-xs text-muted-foreground">
                          {timeAgo(n.createdAt)}
                        </div>
                      </div>

                      {n.type ? (
                        <Badge variant="outline" className="border-border/60 bg-muted/20 shrink-0">
                          {n.type}
                        </Badge>
                      ) : null}
                    </div>
                  </button>
                ))}

                {nextCursor ? (
                  <>
                    <Separator className="bg-border/60" />
                    <div className="p-4">
                      <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={loadMore}
                        disabled={loadingMore}
                      >
                        <ChevronDown className="h-4 w-4" />
                        {loadingMore ? "Loading..." : "Load more"}
                      </Button>
                    </div>
                  </>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        {!loading && unreadIds.length ? (
          <div className="text-xs text-muted-foreground">
          
          </div>
        ) : null}
      </div>
    </PageContainer>
  );
}