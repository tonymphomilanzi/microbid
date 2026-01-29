import { Link } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import { Button } from "../components/ui/button";

export default function Home() {
  return (
    <PageContainer>
      <section className="py-10 sm:py-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="space-y-4">
            <p className="inline-flex rounded-full border bg-muted px-3 py-1 text-xs text-muted-foreground">
              Buy & sell digital assets safely
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
              Buy and sell social pages, channels, and profiles with microbid.
            </h1>
            <p className="text-muted-foreground">
              Discover high-quality YouTube channels, Instagram pages, TikTok profiles and more.
              Sellers can list assets with verified metrics and close deals securely.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <Link to="/marketplace">Browse Marketplace</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/create">Create Listing</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { label: "Verified metrics", value: "Followers, views, ER%" },
                { label: "Secure checkout", value: "Stripe payments" },
                { label: "Seller dashboard", value: "Manage listings" },
                { label: "Buyer access", value: "Saved purchases" },
              ].map((x) => (
                <div key={x.label} className="rounded-xl border bg-muted/40 p-4">
                  <div className="text-sm font-medium">{x.label}</div>
                  <div className="text-sm text-muted-foreground">{x.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </PageContainer>
  );
}