import { useEffect, useMemo, useState } from "react";
import { adminService } from "../../services/admin.service";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Switch } from "../../components/ui/switch";
import ConfirmDeleteDialog from "../../components/ui/ConfirmDeleteDialog";

function slugify(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function AdminPlatforms() {
  const [loading, setLoading] = useState(true);
  const [platforms, setPlatforms] = useState([]);
  const [error, setError] = useState("");

  const [create, setCreate] = useState({
    name: "",
    slug: "",
    order: 0,
    isActive: true,
  });
  const [createLoading, setCreateLoading] = useState(false);

  // map: id -> draft fields
  const [drafts, setDrafts] = useState({}); // { [id]: { name, slug, order, isActive } }
  const [savingId, setSavingId] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  async function load() {
    setError("");
    setLoading(true);
    try {
      const { platforms } = await adminService.getPlatforms();
      setPlatforms(platforms ?? []);

      // initialize drafts from fetched platforms
      const map = {};
      (platforms ?? []).forEach((p) => {
        map[p.id] = {
          name: p.name ?? "",
          slug: p.slug ?? "",
          order: p.order ?? 0,
          isActive: Boolean(p.isActive),
        };
      });
      setDrafts(map);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to load platforms");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const canCreate = useMemo(() => {
    return create.name.trim() && create.slug.trim();
  }, [create.name, create.slug]);

  function hasChanges(p) {
    const d = drafts[p.id];
    if (!d) return false;
    return (
      d.name !== (p.name ?? "") ||
      d.slug !== (p.slug ?? "") ||
      Number(d.order) !== Number(p.order ?? 0) ||
      Boolean(d.isActive) !== Boolean(p.isActive)
    );
  }

  async function createPlatform() {
    if (!canCreate) return;
    setCreateLoading(true);
    try {
      await adminService.createPlatform({
        name: create.name.trim(),
        slug: create.slug.trim(),
        order: Number(create.order ?? 0),
        isActive: Boolean(create.isActive),
      });
      setCreate({ name: "", slug: "", order: 0, isActive: true });
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to create platform");
    } finally {
      setCreateLoading(false);
    }
  }

  async function savePlatform(id) {
    const original = platforms.find((p) => p.id === id);
    const d = drafts[id];
    if (!original || !d) return;

    setSavingId(id);
    try {
      await adminService.updatePlatform(id, {
        name: d.name.trim(),
        slug: d.slug.trim(),
        order: Number(d.order ?? 0),
        isActive: Boolean(d.isActive),
      });
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to update platform");
    } finally {
      setSavingId("");
    }
  }

  async function confirmDelete() {
    if (!toDelete?.id) return;
    setDeleteLoading(true);
    try {
      await adminService.deletePlatform(toDelete.id);
      setDeleteOpen(false);
      setToDelete(null);
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to delete platform");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platforms</h1>
        <p className="text-sm text-muted-foreground">
          Manage platform chips (admin-controlled). Listings must use an active platform.
        </p>
      </div>

      {error ? (
        <Card className="border-border/60 bg-card/60">
          <CardContent className="p-5 text-sm">
            <div className="font-medium">Error</div>
            <div className="mt-1 text-muted-foreground">{error}</div>
            <div className="mt-4">
              <Button variant="outline" onClick={load}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Create */}
      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium">Add platform</div>
            <Badge variant="outline" className="border-border/60 bg-muted/20">
              Public chips
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-1">
              <Input
                placeholder="Name (e.g. YouTube)"
                value={create.name}
                onChange={(e) =>
                  setCreate((c) => ({
                    ...c,
                    name: e.target.value,
                    slug: c.slug || slugify(e.target.value),
                  }))
                }
              />
            </div>

            <div className="sm:col-span-1">
              <Input
                placeholder="Slug (e.g. youtube)"
                value={create.slug}
                onChange={(e) => setCreate((c) => ({ ...c, slug: slugify(e.target.value) }))}
              />
            </div>

            <div className="sm:col-span-1">
              <Input
                placeholder="Order"
                inputMode="numeric"
                value={create.order}
                onChange={(e) => setCreate((c) => ({ ...c, order: e.target.value }))}
              />
            </div>

            <div className="sm:col-span-1 flex items-center justify-between rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
              <span className="text-sm text-muted-foreground">Active</span>
              <Switch
                checked={Boolean(create.isActive)}
                onCheckedChange={(v) => setCreate((c) => ({ ...c, isActive: v }))}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={createPlatform} disabled={!canCreate || createLoading}>
              {createLoading ? "Creating..." : "Create platform"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-0">
          <div className="divide-y divide-border/60">
            {loading ? (
              <div className="p-6 text-sm text-muted-foreground">Loading platforms…</div>
            ) : platforms.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No platforms yet.</div>
            ) : (
              platforms.map((p) => {
                const d = drafts[p.id] || {};
                const changed = hasChanges(p);

                return (
                  <div key={p.id} className="p-4 space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium truncate">{p.name}</div>
                          <Badge variant="outline" className="border-border/60 bg-muted/20">
                            {p.slug}
                          </Badge>
                          {p.isActive ? (
                            <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-border/60 bg-muted/20">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">ID: {p.id}</div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="destructive"
                          onClick={() => {
                            setToDelete(p);
                            setDeleteOpen(true);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-4">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Name</div>
                        <Input
                          value={d.name ?? ""}
                          onChange={(e) =>
                            setDrafts((m) => ({
                              ...m,
                              [p.id]: { ...m[p.id], name: e.target.value },
                            }))
                          }
                        />
                      </div>

                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Slug</div>
                        <Input
                          value={d.slug ?? ""}
                          onChange={(e) =>
                            setDrafts((m) => ({
                              ...m,
                              [p.id]: { ...m[p.id], slug: slugify(e.target.value) },
                            }))
                          }
                        />
                      </div>

                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Order</div>
                        <Input
                          inputMode="numeric"
                          value={d.order ?? 0}
                          onChange={(e) =>
                            setDrafts((m) => ({
                              ...m,
                              [p.id]: { ...m[p.id], order: e.target.value },
                            }))
                          }
                        />
                      </div>

                      <div className="flex items-end">
                        <div className="w-full flex items-center justify-between rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
                          <span className="text-sm text-muted-foreground">Active</span>
                          <Switch
                            checked={Boolean(d.isActive)}
                            onCheckedChange={(v) =>
                              setDrafts((m) => ({
                                ...m,
                                [p.id]: { ...m[p.id], isActive: v },
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        disabled={!changed || savingId === p.id}
                        onClick={() => {
                          // reset draft to original
                          setDrafts((m) => ({
                            ...m,
                            [p.id]: {
                              name: p.name ?? "",
                              slug: p.slug ?? "",
                              order: p.order ?? 0,
                              isActive: Boolean(p.isActive),
                            },
                          }));
                        }}
                      >
                        Reset
                      </Button>

                      <Button disabled={!changed || savingId === p.id} onClick={() => savePlatform(p.id)}>
                        {savingId === p.id ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={(o) => {
          setDeleteOpen(o);
          if (!o) setToDelete(null);
        }}
        loading={deleteLoading}
        title="Delete platform?"
        description={
          toDelete
            ? `Delete "${toDelete.name}"? Existing listings using this platform will still have the old string value, but you won't be able to select it for new listings if removed.`
            : "This cannot be undone."
        }
        confirmText="Delete platform"
        onConfirm={confirmDelete}
      />
    </div>
  );
}