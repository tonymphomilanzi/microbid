import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";
import { streamsService } from "../services/streams.service";
import { ArrowLeft, Eye } from "lucide-react";

function formatViews(n) {
  const v = Number(n || 0);
  if (!Number.isFinite(v) || v < 0) return "0";
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`.replace(".0", "");
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`.replace(".0", "");
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`.replace(".0", "");
  return String(v);
}

export default function StreamWatch() {
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function run() {
      setLoading(true);
      setError("");
      try {
        const res = await streamsService.getStream(id);
        if (!mounted) return;
        setStream(res.stream);
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || e.message || "Failed to load stream");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (id) run();
    return () => (mounted = false);
  }, [id]);

  return (
    <PageContainer>
      <div className="py-8 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Link to="/streams">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>

          {stream ? (
            <Badge variant="outline" className="border-border/60 bg-muted/20">
              <span className="inline-flex items-center gap-2">
                <Eye className="h-4 w-4" />
                {formatViews(stream.viewsCount)}
              </span>
            </Badge>
          ) : null}
        </div>

        {loading ? (
          <div className="py-10 text-sm text-muted-foreground">Loading…</div>
        ) : error ? (
          <Card className="border-border/60 bg-card/60">
            <CardContent className="p-6">
              <div className="text-sm font-medium">Stream error</div>
              <div className="mt-1 text-sm text-destructive">{error}</div>
            </CardContent>
          </Card>
        ) : !stream ? (
          <div className="py-10 text-sm text-muted-foreground">Not found.</div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            {/* Video area */}
            <div className="flex justify-center">
              <div className="w-full max-w-[420px]">
                <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-black aspect-[9/16]">
                  <video
                    src={stream.videoUrl}
                    className="h-full w-full object-cover"
                    controls
                    playsInline
                    autoPlay
                    muted
                    loop
                  />
                </div>

                <div className="mt-3">
                  <div className="text-lg font-semibold tracking-tight">{stream.title}</div>
                  {stream.caption ? (
                    <div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                      {stream.caption}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Side panel */}
            <Card className="border-border/60 bg-card/60 h-fit">
              <CardContent className="p-5 space-y-3">
                <div className="text-sm font-semibold">Details</div>
                <div className="text-sm text-muted-foreground">
                  Views are counted when a viewer opens this page (unique per device/user).
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/10 p-3 text-sm">
                  <div className="text-xs text-muted-foreground">Created</div>
                  <div className="mt-1 font-medium">
                    {stream.createdAt ? new Date(stream.createdAt).toLocaleString() : "—"}
                  </div>
                </div>

                <Button asChild variant="outline" className="w-full">
                  <Link to="/streams">Back to Streams</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PageContainer>
  );
}