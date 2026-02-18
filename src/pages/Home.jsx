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

  const STREAMING_KITS_SLUG = "streaming-kit"; // must match Category.slug in DB
  const [streamingKits, setStreamingKits] = useState([]);

  useEffect(() => {
    let mounted = true;

    const isStreamingKit = (l) => {
      const slug = l?.category?.slug?.toLowerCase();
      const name = l?.category?.name?.toLowerCase();
      return slug === STREAMING_KITS_SLUG || name === "streaming-kit";
    };

    async function run() {
      setLoading(true);
      try {
        const { listings } = await listingsService.getListings();
        if (!mounted) return;

        const all = listings ?? [];
        const kits = all.filter(isStreamingKit).slice(0, 6);
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

  const trust = useMemo(
    () => [
      {
        icon: ShieldCheck,
        title: "Escrow-first",
        desc: "Reduce risk with secure escrow holding funds until successful transfer and verification.",
      },
      {
        icon: BadgeCheck,
        title: "Metrics-focused",
        desc: "Listings showcase key stats to verify performance and value at a glance.",
      },
      {
        icon: CreditCard,
        title: "Flexible checkout",
        desc: ["MOMO", "BTC", "Bank", "WU"],
},
    ],
    []
  );

  return (
    <div className="relative overflow-hidden">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-[-12%] h-[560px] w-[560px] rounded-full bg-primary/18 blur-3xl" />
        <div className="absolute top-20 right-[-10%] h-[520px] w-[520px] rounded-full bg-yellow-400/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(1100px_circle_at_25%_0%,rgba(250,204,21,0.12),transparent_55%)]" />
      </div>

      <PageContainer className="relative">
        {/* HERO */}
        <section className="py-10 sm:py-16">
          <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/40 backdrop-blur-xl">
            {/* hero gradient layer */}
            <div className="absolute inset-0">
              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(250,204,21,0.14),transparent_45%,rgba(99,102,241,0.10))]" />
              <div className="absolute inset-0 bg-[radial-gradient(800px_circle_at_15%_20%,rgba(99,102,241,0.14),transparent_60%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(700px_circle_at_85%_30%,rgba(250,204,21,0.16),transparent_60%)]" />
            </div>

            <div className="relative grid items-center gap-10 p-6 sm:p-10 lg:grid-cols-2">
              {/* Left */}
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full bg-primary text-primary-foreground px-3 py-1">
                    Marketplace
                  </Badge>
                 
                  <Badge
                    variant="secondary"
                    className="rounded-full bg-muted/40 px-3 py-1"
                  >
                    Built for digital assets
                  </Badge>
                </div>

                <div className="space-y-3">
                  <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
                    Buy & sell social media assets{" "}
                    <span className="block bg-gradient-to-r from-primary via-primary to-yellow-400 bg-clip-text text-transparent">
                      with confidence.
                    </span>
                  </h1>

                  <p className="max-w-xl text-base sm:text-lg text-muted-foreground leading-7">
                    A modern marketplace for digital assets like YouTube channels, Instagram pages, TikTok profiles, and more powered by a
                    safer escrow flow and clear metrics.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button asChild size="lg" className="gap-2 px-6 rounded-2xl">
                    <Link to="/marketplace">
                      Browse Marketplace <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>

                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="gap-2 rounded-2xl border-border/60 bg-background/40 hover:bg-muted/30"
                  >
                    <Link to="/create">
                      Create Listing <Sparkles className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>

                {/* Trust row */}
                <div className="grid gap-3 sm:grid-cols-3">
                  {trust.map((t) => (
                    <TrustTile key={t.title} icon={t.icon} title={t.title} desc={t.desc} />
                  ))}
                </div>

                {/* Quick platform chips */}
                <div className="pt-1">
                  <div className="text-xs font-medium text-muted-foreground">Popular platforms</div>
                  <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {CATEGORIES.map((c) => (
                      <Button
                        key={c.label}
                        asChild
                        variant="outline"
                        className="shrink-0 rounded-full border-border/60 bg-background/40 hover:bg-muted/30"
                      >
                        <Link to={c.href}>{c.label}</Link>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right (modern preview stack) */}
              <div className="relative">
                {/* subtle frame */}
                <div className="absolute -inset-2 rounded-[28px] bg-gradient-to-b from-primary/15 via-transparent to-yellow-400/15 blur-2xl" />

                <div className="relative grid gap-4">
                  <Card className="rounded-2xl border-border/60 bg-background/55 backdrop-blur-xl shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold tracking-tight">Market snapshot</div>
                          <div className="text-sm text-muted-foreground">
                            Browse by platform, price, and performance.
                          </div>
                        </div>

                        <Badge
                          variant="outline"
                          className="rounded-full border-primary/30 bg-primary/10 text-primary"
                        >
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

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Card className="rounded-2xl border-border/60 bg-background/55 backdrop-blur-xl shadow-sm">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold tracking-tight">Escrow status</div>
                          <span className="h-2 w-2 rounded-full bg-emerald-500/90" />
                        </div>
                        <div className="mt-2 text-sm text-muted-foreground leading-6">
                          When a buyer submits payment, the listing is reserved and verified before transfer.
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-border/60 bg-background/55 backdrop-blur-xl shadow-sm">
                      <CardContent className="p-5">
                        <div className="text-sm font-semibold tracking-tight">Fast publishing</div>
                        <div className="mt-2 text-sm text-muted-foreground leading-6">
                          Upload images quickly and publish listings in minutes.
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="rounded-2xl border-border/60 bg-background/55 backdrop-blur-xl shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold tracking-tight">Start exploring</div>
                        <Button asChild variant="secondary" className="rounded-xl">
                          <Link to="/marketplace">Open marketplace</Link>
                        </Button>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                          <div className="text-xs text-muted-foreground">Platforms</div>
                          <div className="mt-1 text-sm font-semibold">5+</div>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                          <div className="text-xs text-muted-foreground">Listings</div>
                          <div className="mt-1 text-sm font-semibold">Fresh</div>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                          <div className="text-xs text-muted-foreground">Support</div>
                          <div className="mt-1 text-sm font-semibold">Chat</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* floating accent */}
              


              </div>
            </div>
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
                <h2 className="text-xl font-semibold tracking-tight">Streaming kit features</h2>
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
                  <Step title="1) Browse" desc="Search & filter by platform, niche, and price." />
                  <Step title="2) Verify" desc="Open listing details to view the full metrics panel." />
                  <Step title="3) Act" desc="Login to message sellers or buy via Stripe, Paypal, MOMO, Crypto." />
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
                <h3 className="text-2xl font-semibold tracking-tight">Ready to list your first asset?</h3>
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

function TrustTile({ icon: Icon, title, desc }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/40 p-4 backdrop-blur transition hover:bg-muted/20 overflow-hidden">
      <div className="flex items-center gap-2 text-sm font-semibold min-w-0">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <Icon className="h-4 w-4" />
        </span>
        <span className="truncate">{title}</span>
      </div>

      {Array.isArray(desc) ? (
        <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {desc.map((x) => (
            <li key={x} className="flex items-center gap-2 min-w-0">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/70 shrink-0" />
              <span className="truncate">{x}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-2 text-sm text-muted-foreground leading-6 break-words">
          {desc}
        </div>
      )}
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
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