import { useEffect, useMemo, useState } from "react";
import { adminService } from "../../services/admin.service";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import ConfirmDeleteDialog from "../../components/ui/ConfirmDeleteDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

function statusStyles(status) {
  if (status === "ACTIVE") {
    return {
      row: "border-emerald-500/25 bg-emerald-500/5",
      badge: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    };
  }
  if (status === "INACTIVE") {
    return {
      row: "border-zinc-500/25 bg-zinc-500/5",
      badge: "border-zinc-500/25 bg-zinc-500/10 text-zinc-200",
    };
  }
  if (status === "SOLD") {
    return {
      row: "border-blue-500/25 bg-blue-500/5",
      badge: "border-blue-500/25 bg-blue-500/10 text-blue-300",
    };
  }
  return {
    row: "border-border/60 bg-card/60",
    badge: "border-border/60 bg-muted/20",
  };
}

export default function AdminListings() {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL | ACTIVE | INACTIVE | SOLD

  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState([]);

  // selection + bulk
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const selectedCount = selectedIds.size;
  const allIds = useMemo(() => listings.map((l) => l.id), [listings]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));

  const [bulkAction, setBulkAction] = useState(""); // "ACTIVE" | "INACTIVE" | "SOLD" | "DELETE"
  const [bulkWorking, setBulkWorking] = useState(false);

  // single delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // bulk delete confirm
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { listings } = await adminService.getListings({
        q: q || undefined,
        status: statusFilter === "ALL" ? undefined : statusFilter,
      });
      setListings(listings ?? []);
      setSelectedIds(new Set()); // reset selection whenever list refreshes
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function toggleOne(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((prev) => {
      if (allSelected) return new Set();
      return new Set(allIds);
    });
  }

  async function applyBulkStatus(status) {
    if (selectedCount === 0) return;
    setBulkWorking(true);
    try {
      // Do in parallel; for very large sets you could chunk these.
      await Promise.all(
        Array.from(selectedIds).map((id) => adminService.updateListing(id, { status }))
      );
      setBulkAction("");
      load();
    } finally {
      setBulkWorking(false);
    }
  }

  async function confirmBulkDelete() {
    if (selectedCount === 0) return;
    setBulkWorking(true);
    try {
      await Promise.all(Array.from(selectedIds).map((id) => adminService.deleteListing(id)));
      setBulkDeleteOpen(false);
      setBulkAction("");
      load();
    } finally {
      setBulkWorking(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Listings</h1>
        <p className="text-sm text-muted-foreground">
          Moderate listings across the marketplace.
        </p>
      </div>

      {/* Toolbar */}
      <div className="grid gap-3 lg:grid-cols-12">
        <div className="lg:col-span-5 flex gap-2">
          <Input
            placeholder="Search title / seller email..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button variant="outline" onClick={load}>
            Search
          </Button>
        </div>

        <div className="lg:col-span-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="border-border/60 bg-card/60">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="ACTIVE">ACTIVE</SelectItem>
              <SelectItem value="INACTIVE">INACTIVE</SelectItem>
              <SelectItem value="SOLD">SOLD</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-border/60 bg-muted/20">
              Selected: {selectedCount}
            </Badge>

            <Button
              variant="outline"
              onClick={toggleAll}
              disabled={loading || listings.length === 0}
            >
              {allSelected ? "Unselect all" : "Select all"}
            </Button>

            <Button
              variant="outline"
              onClick={() => setSelectedIds(new Set())}
              disabled={selectedCount === 0}
            >
              Clear
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Select value={bulkAction} onValueChange={setBulkAction}>
              <SelectTrigger className="w-[180px] border-border/60 bg-card/60">
                <SelectValue placeholder="Bulk action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Set ACTIVE</SelectItem>
                <SelectItem value="INACTIVE">Set INACTIVE</SelectItem>
                <SelectItem value="SOLD">Set SOLD</SelectItem>
                <SelectItem value="DELETE">Delete</SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={() => {
                if (!bulkAction || selectedCount === 0) return;

                if (bulkAction === "DELETE") setBulkDeleteOpen(true);
                else applyBulkStatus(bulkAction);
              }}
              disabled={!bulkAction || selectedCount === 0 || bulkWorking}
            >
              {bulkWorking ? "Applying..." : "Apply"}
            </Button>

            <Button
              variant="secondary"
              onClick={load}
              disabled={bulkWorking}
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Apply status filter button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={load}
          disabled={loading}
        >
          Apply filters
        </Button>
      </div>

      {/* List */}
      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-0">
          <div className="divide-y divide-border/60">
            {loading ? (
              <div className="p-6 text-sm text-muted-foreground">Loading listings…</div>
            ) : listings.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No listings found.</div>
            ) : (
              listings.map((l) => {
                const s = statusStyles(l.status);
                const checked = selectedIds.has(l.id);

                return (
                  <div key={l.id} className={`m-3 rounded-xl border p-4 ${s.row}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOne(l.id)}
                          className="mt-1 h-4 w-4 accent-primary"
                        />

                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-medium truncate">{l.title}</div>
                            <Badge variant="outline" className={s.badge}>
                              {l.status}
                            </Badge>
                          </div>

                          <div className="text-sm text-muted-foreground">
                            {l.platform} • ${l.price}
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge variant="outline" className="border-border/60 bg-muted/20">
                              {l.seller?.email}
                            </Badge>

                            {l.category?.name ? (
                              <Badge variant="outline" className="border-border/60 bg-muted/20">
                                {l.category.name}
                              </Badge>
                            ) : null}

                            {l.seller?.isVerified ? (
                              <Badge className="bg-primary text-primary-foreground">
                                Verified seller
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        <Button
                          size="sm"
                          variant={l.status === "ACTIVE" ? "default" : "outline"}
                          onClick={() => setStatus(l.id, "ACTIVE")}
                        >
                          ACTIVE
                        </Button>

                        <Button
                          size="sm"
                          variant={l.status === "INACTIVE" ? "default" : "outline"}
                          onClick={() => setStatus(l.id, "INACTIVE")}
                        >
                          INACTIVE
                        </Button>

                        <Button
                          size="sm"
                          variant={l.status === "SOLD" ? "default" : "outline"}
                          onClick={() => setStatus(l.id, "SOLD")}
                        >
                          SOLD
                        </Button>

                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setToDelete(l);
                            setDeleteOpen(true);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Single delete */}
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={(o) => {
          setDeleteOpen(o);
          if (!o) setToDelete(null);
        }}
        loading={deleteLoading}
        title="Delete listing?"
        description={
          toDelete ? `Delete "${toDelete.title}"? This cannot be undone.` : "This cannot be undone."
        }
        confirmText="Delete"
        onConfirm={confirmDelete}
      />

      {/* Bulk delete */}
      <ConfirmDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={(o) => setBulkDeleteOpen(o)}
        loading={bulkWorking}
        title="Delete selected listings?"
        description={`You are about to delete ${selectedCount} listing(s). This cannot be undone.`}
        confirmText="Delete all"
        onConfirm={confirmBulkDelete}
      />
    </div>
  );
}