import { useEffect, useState } from "react";
import { adminService } from "../../services/admin.service";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Switch } from "../../components/ui/switch";

export default function AdminUsers() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);

  async function load() {
    setLoading(true);
    try {
      const { users } = await adminService.getUsers({ q: q || undefined });
      setUsers(users ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateUser(id, patch) {
    await adminService.updateUser(id, patch);
    load();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">Verify users, set tier, set role.</p>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Search email or uid..." value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="outline" onClick={load}>Search</Button>
      </div>

      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-0">
          <div className="divide-y divide-border/60">
            {loading ? (
              <div className="p-6 text-sm text-muted-foreground">Loading users…</div>
            ) : users.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No users found.</div>
            ) : (
              users.map((u) => (
                <div key={u.id} className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{u.email}</div>
                    <div className="text-xs text-muted-foreground truncate">{u.id}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="outline">Role: {u.role}</Badge>
                      <Badge variant="outline">Tier: {u.tier}</Badge>
                      <Badge variant="outline">Listings: {u._count?.listings ?? 0}</Badge>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                      <span className="text-sm text-muted-foreground">Verified</span>
                      <Switch
                        checked={Boolean(u.isVerified)}
                        onCheckedChange={(v) => updateUser(u.id, { isVerified: v })}
                      />
                    </div>

                    <Button variant="outline" onClick={() => updateUser(u.id, { tier: "FREE" })}>FREE</Button>
                    <Button variant="outline" onClick={() => updateUser(u.id, { tier: "PRO" })}>PRO</Button>
                    <Button variant="outline" onClick={() => updateUser(u.id, { tier: "VIP" })}>VIP</Button>

                    <Button variant="secondary" onClick={() => updateUser(u.id, { role: "USER" })}>Make USER</Button>
                    <Button onClick={() => updateUser(u.id, { role: "ADMIN" })}>Make ADMIN</Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
