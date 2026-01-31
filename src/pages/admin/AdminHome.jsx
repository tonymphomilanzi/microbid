import { Card, CardContent } from "../../components/ui/card";
import { adminService } from "../../services/admin.service";
import { useEffect, useState } from "react";

export default function AdminHome() {
  const [stats, setStats] = useState({ users: 0, listings: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      try {
        const [{ users }, { listings }] = await Promise.all([
          adminService.getUsers(),
          adminService.getListings(),
        ]);
        if (!mounted) return;
        setStats({ users: users?.length ?? 0, listings: listings?.length ?? 0 });
      } finally {
        if (mounted) setLoading(false);
      }
    }
    run();
    return () => (mounted = false);
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">Admin console overview.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/60 bg-card/60">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Users</div>
            <div className="mt-1 text-xl font-semibold">{loading ? "…" : stats.users}</div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Listings</div>
            <div className="mt-1 text-xl font-semibold">{loading ? "…" : stats.listings}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}