import { useEffect, useState } from "react";
import { adminService } from "../../services/admin.service";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import ConfirmDeleteDialog from "../../components/ui/ConfirmDeleteDialog";

export default function AdminListings() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState([]);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { listings } = await adminService.getListings({ q: q || undefined });
      setListings(listings ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function confirmDelete() {
    if (!toDelete?.id) return;
    setDeleteLoading(true);
    try {
      await adminService.deleteListing(toDelete.id);
      setDeleteOpen(false);
      setToDelete(null);
      load();
    } finally {
      setDeleteLoading(false);
    }
  }

  async function setStatus(id, status) {
    await adminService.updateListing(id, { status });
    load();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Listings</h1>
        <p className="text-sm text-muted-foreground">Moderate listings across the marketplace.</p>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Search title / seller email..." value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="outline" onClick={load}>Search</Button>
      </div>

      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-0">
          <div className="divide-y divide-border/60">
            {loading ? (
              <div className="p-6 text-sm text-muted-foreground">Loading listings…</div>
            ) : listings.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No listings found.</div>
            ) : (
              listings.map((l) => (
                <div key={l.id} className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{l.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {l.platform} • ${l.price} • {l.status}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="outline">{l.seller?.email}</Badge>
                      {l.category?.name ? <Badge variant="outline">{l.category.name}</Badge> : null}
                      {l.seller?.isVerified ? <Badge className="bg-primary text-primary-foreground">Verified seller</Badge> : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setStatus(l.id, "ACTIVE")}>ACTIVE</Button>
                    <Button variant="outline" onClick={() => setStatus(l.id, "INACTIVE")}>INACTIVE</Button>

                    <Button
                      variant="destructive"
                      onClick={() => { setToDelete(l); setDeleteOpen(true); }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={(o) => { setDeleteOpen(o); if (!o) setToDelete(null); }}
        loading={deleteLoading}
        title="Delete listing?"
        description={toDelete ? `Delete "${toDelete.title}"? This cannot be undone.` : "This cannot be undone."}
        confirmText="Delete"
        onConfirm={confirmDelete}
      />
    </div>
  );
}