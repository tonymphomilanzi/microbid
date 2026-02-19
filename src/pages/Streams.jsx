import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { streamsService } from "../services/streams.service";
import { Eye, ChevronDown } from "lucide-react";

function formatViews(n) {
  const v = Number(n || 0);
  if (!Number.isFinite(v) || v < 0) return "0";
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`.replace(".0", "");
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`.replace(".0", "");
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`.replace(".0", "");
  return String(v);
}

export default function Streams() {
  const [loading, setLoading] = useState(true);
  const [streams, setStreams] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  async function loadFirst() {
    setLoading(true);
    setError("");
    try {
      const res = await streamsService.getStreams({ take: 24 });
      setStreams(res.streams ?? []);
      setNextCursor(res.nextCursor ?? null);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to load streams");
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await streamsService.getStreams({ take: 24, cursor: nextCursor });
      setStreams((prev) => [...prev, ...(res.streams ?? [])]);
      setNextCursor(res.nextCursor ?? null);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    loadFirst();
  }, []);

  const hasItems = useMemo(() => streams.length > 0, [streams.length]);

  return (
    <PageContainer>
      <div className="py-8 space-y-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Streams</h1>
            <p className="text-sm text-muted-foreground"></p>
          </div>
          <Badge variant="outline" className="border-border/60 bg-muted/20">
            Public
          </Badge>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : error ? (
          <Card className="border-border/60 bg-card/60">
            <CardContent className="p-5">
              <div className="text-sm font-medium">Could not load streams</div>
              <div className="mt-1 text-sm text-destructive">{error}</div>
              <div className="mt-4">
                <Button variant="outline" onClick={loadFirst}>
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : !hasItems ? (
          <Card className="border-border/60 bg-card/60">
            <CardContent className="p-10 text-center text-sm text-muted-foreground">
              No streams yet.
            </CardContent>
          </Card>
        ) : (
          <>
            {/*  grid */}
            <div className="grid gap-2 grid-cols-3 sm:grid-cols-3 lg:grid-cols-4">
              {streams.map((s) => (
                <Link key={s.id} to={`/streams/${s.id}`} className="group">
                  <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-muted/10 aspect-[9/16]">
                    <img
                      src={s.coverImageUrl}
                      alt={s.title}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                      loading="lazy"
                    />

                    {/* top-right views pill */}
                    <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] text-white backdrop-blur">
                      <Eye className="h-3.5 w-3.5" />
                      {formatViews(s.viewsCount)}
                    </div>

                    {/* bottom gradient + title */}
                    <div className="absolute inset-x-0 bottom-0 p-2">
                      <div className="rounded-xl bg-gradient-to-t from-black/75 via-black/20 to-transparent p-2">
                        <div className="text-sm font-semibold text-white line-clamp-2 drop-shadow">
                          {s.title}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {nextCursor ? (
              <div className="pt-2">
                <Button
                  variant="outline"
                  className="w-full gap-2 border-border/60 bg-background/60"
                  disabled={loadingMore}
                  onClick={loadMore}
                >
                  <ChevronDown className="h-4 w-4" />
                  {loadingMore ? "Loading..." : "Load more"}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </PageContainer>
  );
}