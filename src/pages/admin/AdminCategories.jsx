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

export default function AdminCategories() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");

  const [create, setCreate] = useState({
    name: "",
    slug: "",
    order: 0,
    isActive: true,
    isAdminOnly: false,
  });
  const [createLoading, setCreateLoading] = useState(false);

  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  async function load() {
    setError("");
    setLoading(true);
    try {
      const { categories } = await adminService.getCategories();
      setCategories(categories ?? []);

      const map = {};
      (categories ?? []).forEach((c) => {
        map[c.id] = {
          name: c.name ?? "",
          slug: c.slug ?? "",
          order: c.order ?? 0,
          isActive: Boolean(c.isActive),
          isAdminOnly: Boolean(c.isAdminOnly),
        };
      });
      setDrafts(map);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to load categories");
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

  function hasChanges(c) {
    const d = drafts[c.id];
    if (!d) return false;
    return (
      d.name !== (c.name ?? "") ||
      d.slug !== (c.slug ?? "") ||
      Number(d.order) !== Number(c.order ?? 0) ||
      Boolean(d.isActive) !== Boolean(c.isActive) ||
      Boolean(d.isAdminOnly) !== Boolean(c.isAdminOnly)
    );
  }

  async function createCategory() {
    if (!canCreate) return;
    setCreateLoading(true);
    try {
      await adminService.createCategory({
        name: create.name.trim(),
        slug: create.slug.trim(),
        order: Number(create.order ?? 0),
        isActive: Boolean(create.isActive),
        isAdminOnly: Boolean(create.isAdminOnly),
      });
      setCreate({ name: "", slug: "", order: 0, isActive: true, isAdminOnly: false });
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to create category");
    } finally {
      setCreateLoading(false);
    }
  }

  async function saveCategory(id) {
    const original = categories.find((c) => c.id === id);
    const d = drafts[id];
    if (!original || !d) return;

    setSavingId(id);
    try {
      await adminService.updateCategory(id, {
        name: d.name.trim(),
        slug: d.slug.trim(),
        order: Number(d.order ?? 0),
        isActive: Boolean(d.isActive),
        isAdminOnly: Boolean(d.isAdminOnly),
      });
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to update category");
    } finally {
      setSavingId("");
    }
  }

  async function confirmDelete() {
    if (!toDelete?.id) return;
    setDeleteLoading(true);
    try {
      await adminService.deleteCategory(toDelete.id);
      setDeleteOpen(false);
      setToDelete(null);
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to delete category");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
        <p className="text-sm text-muted-foreground">
          Manage category chips. Use “Admin only” for Streaming Kit and other restricted sections.
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
            <div className="font-medium">Add category</div>
            <Badge variant="outline" className="border-border/60 bg-muted/20">
              Public chips
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-1">
              <Input
                placeholder="Name (e.g. Finance)"
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
                placeholder="Slug (e.g. finance)"
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

            <div className="sm:col-span-1 space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
                <span className="text-sm text-muted-foreground">Active</span>
                <Switch
                  checked={Boolean(create.isActive)}
                  onCheckedChange={(v) => setCreate((c) => ({ ...c, isActive: v }))}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
                <span className="text-sm text-muted-foreground">Admin only</span>
                <Switch
                  checked={Boolean(create.isAdminOnly)}
                  onCheckedChange={(v) => setCreate((c) => ({ ...c, isAdminOnly: v }))}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={createCategory} disabled={!canCreate || createLoading}>
              {createLoading ? "Creating..." : "Create category"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-0">
          <div className="divide-y divide-border/60">
            {loading ? (
              <div className="p-6 text-sm text-muted-foreground">Loading categories…</div>
            ) : categories.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No categories yet.</div>
            ) : (
              categories.map((c) => {
                const d = drafts[c.id] || {};
                const changed = hasChanges(c);

                return (
                  <div key={c.id} className="p-4 space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium truncate">{c.name}</div>
                          <Badge variant="outline" className="border-border/60 bg-muted/20">
                            {c.slug}
                          </Badge>
                          {c.isAdminOnly ? (
                            <Badge className="bg-primary text-primary-foreground">Admin only</Badge>
                          ) : null}
                          {c.isActive ? (
                            <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-border/60 bg-muted/20">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">ID: {c.id}</div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="destructive"
                          onClick={() => {
                            setToDelete(c);
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
                              [c.id]: { ...m[c.id], name: e.target.value },
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
                              [c.id]: { ...m[c.id], slug: slugify(e.target.value) },
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
                              [c.id]: { ...m[c.id], order: e.target.value },
                            }))
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
                          <span className="text-sm text-muted-foreground">Active</span>
                          <Switch
                            checked={Boolean(d.isActive)}
                            onCheckedChange={(v) =>
                              setDrafts((m) => ({
                                ...m,
                                [c.id]: { ...m[c.id], isActive: v },
                              }))
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
                          <span className="text-sm text-muted-foreground">Admin only</span>
                          <Switch
                            checked={Boolean(d.isAdminOnly)}
                            onCheckedChange={(v) =>
                              setDrafts((m) => ({
                                ...m,
                                [c.id]: { ...m[c.id], isAdminOnly: v },
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        disabled={!changed || savingId === c.id}
                        onClick={() => {
                          setDrafts((m) => ({
                            ...m,
                            [c.id]: {
                              name: c.name ?? "",
                              slug: c.slug ?? "",
                              order: c.order ?? 0,
                              isActive: Boolean(c.isActive),
                              isAdminOnly: Boolean(c.isAdminOnly),
                            },
                          }));
                        }}
                      >
                        Reset
                      </Button>

                      <Button disabled={!changed || savingId === c.id} onClick={() => saveCategory(c.id)}>
                        {savingId === c.id ? "Saving..." : "Save"}
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
        title="Delete category?"
        description={
          toDelete
            ? `Delete "${toDelete.name}"? If listings reference this category, you may want to reassign them first.`
            : "This cannot be undone."
        }
        confirmText="Delete category"
        onConfirm={confirmDelete}
      />
    </div>
  );
}