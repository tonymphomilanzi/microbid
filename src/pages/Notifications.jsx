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

function SkeletonRow() {
  return (
    <div className="p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="mt-1 h-2.5 w-2.5 rounded-full bg-muted animate-pulse" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
          <div className="h-3 w-full rounded bg-muted/80 animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-muted/70 animate-pulse" />
        </div>
        <div className="h-5 w-16 rounded bg-muted animate-pulse" />
      </div>
    </div>
  );
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

  const unreadIds = useMemo(
    () => items.filter((n) => !n.isRead).map((n) => n.id),
    [items]
  );

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
    if (!n.isRead) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
      listingsService.markNotificationsRead([n.id]).catch(() => {});
    }
    if (n.url) navigate(n.url);
  }

  return (
    <PageContainer>
      <div className="py-8">
        <div className="mx-auto max-w-3xl space-y-5">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                <span className="bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
                  Notifications
                </span>
              </h1>
              <p className="text-sm text-muted-foreground">
                Updates about bids, purchases, sales, and escrow.
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
              ) : items.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="mx-auto mb-2 h-10 w-10 rounded-2xl bg-muted/40 ring-1 ring-border/60" />
                  <div className="text-sm font-medium">No notifications</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    You’re all caught up. New updates will appear here.
                  </div>
                </div>
              ) : (
                <div className="p-2 sm:p-3 space-y-2">
                  {items.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => openNotification(n)}
                      className={[
                        "group w-full text-left rounded-xl border transition",
                        "border-border/60 bg-background/60 hover:bg-muted/30",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        !n.isRead ? "ring-1 ring-primary/20 bg-primary/[0.06]" : "",
                      ].join(" ")}
                    >
                      <div className="p-4 sm:p-5">
                        <div className="flex items-start gap-3">
                          {/* status dot */}
                          <span
                            className={[
                              "mt-1.5 h-2.5 w-2.5 rounded-full shrink-0",
                              n.isRead ? "bg-muted" : "bg-primary",
                            ].join(" ")}
                            aria-hidden="true"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-medium truncate">{n.title}</div>

                              {!n.isRead ? (
                                <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
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

                          <div className="flex items-center gap-2 shrink-0">
                            {n.type ? (
                              <Badge
                                variant="outline"
                                className="rounded-full border-border/60 bg-muted/20 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide"
                              >
                                {n.type}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}

                  {nextCursor ? (
                    <>
                      <Separator className="bg-border/60" />
                      <div className="pt-1">
                        <Button
                          variant="outline"
                          className="w-full rounded-xl gap-2 border-border/60 bg-background/60 hover:bg-muted/40"
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

          {/* Optional footer hint (kept subtle) */}
          {!loading && unreadIds.length ? (
            <p className="text-xs text-muted-foreground">
              Tip: unread notifications are highlighted.
            </p>
          ) : null}
        </div>
      </div>
    </PageContainer>
  );
}