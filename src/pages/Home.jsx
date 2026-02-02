import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";
import ListingGrid from "../components/listings/ListingGrid";
import { listingsService } from "../services/listings.service";
import {
  ShieldCheck,
  Sparkles,
  TrendingUp,
  ArrowRight,
  BadgeCheck,
  CreditCard,
} from "lucide-react";

const CATEGORIES = [
  { label: "YouTube", href: "/marketplace?platform=YouTube" },
  { label: "Instagram", href: "/marketplace?platform=Instagram" },
  { label: "TikTok", href: "/marketplace?platform=TikTok" },
  { label: "X", href: "/marketplace?platform=X" },
  { label: "Facebook", href: "/marketplace?platform=Facebook" },
];

export default function Home() {


  
  const [loading, setLoading] = useState(true);
  const [featured, setFeatured] = useState([]);

  const STREAMING_KITS_SLUG = "streaming-kits"; // <-- must match Category.slug in DB

  const [streamingKits, setStreamingKits] = useState([]);

useEffect(() => {
  let mounted = true;

  const isStreamingKit = (l) => {
    const slug = l?.category?.slug?.toLowerCase();
    const name = l?.category?.name?.toLowerCase();
    return slug === STREAMING_KITS_SLUG || name === "streaming kits";
  };

  async function run() {
    setLoading(true);
    try {
      const { listings } = await listingsService.getListings();
      if (!mounted) return;

      const all = listings ?? [];

      // ONLY streaming kits
      const kits = all.filter(isStreamingKit).slice(0, 6);

      // Featured EXCLUDING streaming kits
      const nonKits = all.filter((l) => !isStreamingKit(l)).slice(0, 6);

      setStreamingKits(kits);
      setFeatured(nonKits);
    } finally {
      if (mounted) setLoading(false);
    }
  }

  run();
  return () => (mounted = false);
}, []);

  const stats = useMemo(
    () => [
      { label: "Verified-style listings", value: "Metrics-first" },
      { label: "Instant uploads", value: "Cloudinary" },
      { label: "Secure checkout", value: "Stripe-ready" },
    ],
    []
  );

  return (
    <div className="relative overflow-hidden">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-[-10%] h-[520px] w-[520px] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_30%_0%,rgba(250,204,21,0.10),transparent_55%)]" />
      </div>

      <PageContainer className="relative">
        {/* HERO */}
        <section className="py-10 sm:py-16">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-primary text-primary-foreground">Marketplace</Badge>
                <Badge variant="outline" className="border-border/60 bg-card/50">
                  Built for digital assets
                </Badge>
              </div>

              <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
  Buy & sell social media assets
  <span className="block bg-gradient-to-r from-primary to-yellow-400 bg-clip-text text-transparent">
    with confidence
  </span>
</h1>


             <p className="max-w-xl text-base text-muted-foreground">
  A secure marketplace for YouTube channels, Instagram pages, TikTok profiles,
  and more — complete with verified metrics escrow secure.
</p>


              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="gap-2 px-6">
                  <Link to="/marketplace">
                    Browse Marketplace <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="gap-2">
                  <Link to="/create">
                    Create Listing <Sparkles className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

             
            </div>

            {/* Right “preview panel” */}
            <div className="space-y-4">
              <Card className="rounded-2xl bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold">Market snapshot</div>
                      <div className="text-sm text-muted-foreground">
                        Discover assets by platform and performance.
                      </div>
                    </div>
                    <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                      Trending
                    </Badge>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <MiniStat icon={TrendingUp} label="Demand" value="High" />
                    <MiniStat icon={BadgeCheck} label="Quality" value="Curated" />
                    <MiniStat icon={ShieldCheck} label="Flow" value="Secure" />
                  </div>
                </CardContent>
              </Card>

          


            </div>
          </div>
        </section>

        {/* CATEGORIES */}
        <section className="pb-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Browse by platform</h2>
              <p className="text-sm text-muted-foreground">
          
              </p>
            </div>
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link to="/marketplace" className="gap-2">
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CATEGORIES.map((c) => (
              <Button
                key={c.label}
                asChild
                variant="outline"
                className="shrink-0 rounded-full border-border/60 bg-card/50 backdrop-blur hover:bg-muted"
              >
                <Link to={c.href}>{c.label}</Link>
              </Button>
            ))}
          </div>
        </section>

        {/* FEATURED LISTINGS */}
        <section className="py-8">
          <div className="flex items-end justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight">Featured listings</h2>
              <p className="text-sm text-muted-foreground">
                Fresh listings from sellers. Click to view full metrics.
              </p>
            </div>
            <Button asChild variant="outline" className="hidden sm:inline-flex">
              <Link to="/marketplace">Explore</Link>
            </Button>
          </div>

          <div className="mt-5">
            <ListingGrid listings={featured} loading={loading} />
          </div>
        </section>

        {/* STREAMING KIT FEATURES */}
{streamingKits.length > 0 && (
  <section className="py-8">
    <div className="flex items-end justify-between gap-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">
          Streaming kit features
        </h2>
        <p className="text-sm text-muted-foreground">
          Dedicated listings from the Streaming Kits category.
        </p>
      </div>

      <Button asChild variant="outline" className="hidden sm:inline-flex">
        <Link to={`/marketplace?category=${STREAMING_KITS_SLUG}`}>Explore</Link>
      </Button>
    </div>

    <div className="mt-5">
      <ListingGrid listings={streamingKits} loading={loading} />
    </div>
  </section>
)}

        {/* HOW IT WORKS */}
        <section className="py-10">
          <Card className="border-border/60 bg-card/60 backdrop-blur">
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold tracking-tight">How it works</h3>
                  <p className="text-sm text-muted-foreground">
                    Browse without login. Create, chat, and purchase with login.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Step
                    title="1) Browse"
                    desc="Search & filter by platform, niche, and price."
                  />
                  <Step
                    title="2) Verify"
                    desc="Open listing details to view the full metrics panel."
                  />
                  <Step
                    title="3) Act"
                    desc="Login to message sellers or buy via Stripe,Paypal,MOMO,Crypto."
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button asChild className="gap-2">
                  <Link to="/marketplace">
                    Start browsing <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/dashboard">Go to dashboard</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* FINAL CTA */}
        <section className="pb-14">
          <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur sm:p-10">
            <div className="absolute inset-0 bg-[radial-gradient(700px_circle_at_20%_30%,rgba(250,204,21,0.18),transparent_60%)]" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <h3 className="text-2xl font-semibold tracking-tight">
                  Ready to list your first asset?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Upload an image, add metrics, set price, and go live in minutes.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild className="gap-2">
                  <Link to="/create">
                    Create listing <Sparkles className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/marketplace">See marketplace</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </PageContainer>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function Step({ title, desc }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{desc}</div>
    </div>
  );
}