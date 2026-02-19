import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import { Card, CardContent } from "../components/ui/card";
import { pagesService } from "../services/pages.service";

export default function SitePage() {
  const location = useLocation();

  const slug = useMemo(() => {
    // "/terms" -> "terms"
    return String(location.pathname || "").replace(/^\//, "").trim();
  }, [location.pathname]);

  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function run() {
      setLoading(true);
      setError("");
      setPage(null);

      try {
        const res = await pagesService.getPage(slug);
        if (!mounted) return;
        setPage(res.page);
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || e.message || "Page not found");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (slug) run();
    return () => (mounted = false);
  }, [slug]);

  return (
    <PageContainer>
      <div className="py-10">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : error ? (
          <Card className="border-border/60 bg-card/60">
            <CardContent className="p-6">
              <div className="text-sm font-medium">Not available</div>
              <div className="mt-1 text-sm text-destructive">{error}</div>
            </CardContent>
          </Card>
        ) : (
          <div className="mx-auto max-w-3xl space-y-4">
            <h1 className="text-3xl font-semibold tracking-tight">{page?.title}</h1>

            {page?.updatedAt ? (
              <div className="text-xs text-muted-foreground">
                Updated: {new Date(page.updatedAt).toLocaleString()}
              </div>
            ) : null}

            <Card className="border-border/60 bg-card/60">
              <CardContent className="p-6">
                {/* Plain text / markdown style display */}
                <div className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {page?.body || ""}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PageContainer>
  );
}