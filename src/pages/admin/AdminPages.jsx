import { useEffect, useMemo, useState } from "react";
import { adminService } from "../../services/admin.service";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Switch } from "../../components/ui/switch";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Separator } from "../../components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { useToast } from "../../hooks/use-toast";
import { Plus, Pencil, Trash2, ExternalLink } from "lucide-react";

function isValidSlug(slug) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

export default function AdminPages() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    slug: "",
    title: "",
    body: "",
    isPublished: true,
  });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await adminService.getPages(q ? { q } : undefined);
      setPages(res.pages ?? []);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to load pages");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => pages, [pages]);

  function openCreate() {
    setEditing(null);
    setForm({ slug: "", title: "", body: "", isPublished: true });
    setOpen(true);
  }

  async function openEdit(row) {
    try {
      const res = await adminService.getPage(row.id);
      setEditing(res.page);
      setForm({
        slug: res.page.slug ?? "",
        title: res.page.title ?? "",
        body: res.page.body ?? "",
        isPublished: Boolean(res.page.isPublished),
      });
      setOpen(true);
    } catch (e) {
      toast({ title: "Could not open", description: e?.response?.data?.message || e.message });
    }
  }

  async function save() {
    const slug = form.slug.trim().toLowerCase();
    const title = form.title.trim();
    const body = String(form.body ?? "");

    if (!slug) return toast({ title: "Missing slug", description: "Slug is required." });
    if (!isValidSlug(slug)) return toast({ title: "Invalid slug", description: "Use lowercase and hyphens only." });
    if (!title) return toast({ title: "Missing title", description: "Title is required." });

    setSaving(true);
    try {
      const payload = { slug, title, body, isPublished: Boolean(form.isPublished) };

      if (editing?.id) {
        await adminService.updatePage(editing.id, payload);
        toast({ title: "Saved", description: "Page updated." });
      } else {
        await adminService.createPage(payload);
        toast({ title: "Created", description: "Page created." });
      }

      setOpen(false);
      await load();
    } catch (e) {
      toast({ title: "Save failed", description: e?.response?.data?.message || e.message || "Try again." });
    } finally {
      setSaving(false);
    }
  }

  function askDelete(id) {
    setDeletingId(id);
    setConfirmDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!deletingId) return;
    try {
      await adminService.deletePage(deletingId);
      toast({ title: "Deleted", description: "Page deleted." });
      setConfirmDeleteOpen(false);
      setDeletingId(null);
      await load();
    } catch (e) {
      toast({ title: "Delete failed", description: e?.response?.data?.message || e.message || "Try again." });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pages</h1>
          <p className="text-sm text-muted-foreground">
            Edit the content for footer links (Terms, Privacy, About, etc.).
          </p>
        </div>

        <Button className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New page
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder="Search slug or title…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="sm:max-w-sm"
        />
        <Button variant="outline" onClick={load}>
          Search
        </Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : error ? (
        <Card className="border-border/60 bg-card/60">
          <CardContent className="p-5">
            <div className="text-sm font-medium">Could not load</div>
            <div className="mt-1 text-sm text-destructive">{error}</div>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-border/60 bg-card/60">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No pages found.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((p) => (
            <Card key={p.id} className="border-border/60 bg-card/60">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold truncate">{p.title}</div>
                      <Badge variant="outline" className="border-border/60 bg-muted/20">
                        /{p.slug}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={p.isPublished ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-border/60 bg-muted/20"}
                      >
                        {p.isPublished ? "Published" : "Hidden"}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Updated: {p.updatedAt ? new Date(p.updatedAt).toLocaleString() : "—"}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => window.open(`/${p.slug}`, "_blank")}>
                      <ExternalLink className="h-4 w-4" />
                      View
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
                      onClick={() => askDelete(p.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Editor dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[820px] max-h-[90vh] overflow-hidden p-0 border-border/60 bg-card/95 backdrop-blur">
          <div className="flex flex-col max-h-[90vh]">
            <DialogHeader className="p-5 sm:p-6">
              <DialogTitle>{editing ? "Edit page" : "New page"}</DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-5 sm:px-6 pb-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Slug *</Label>
                  <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
                  <div className="mt-1 text-xs text-muted-foreground">Example: terms, privacy-policy</div>
                </div>

                <div>
                  <Label>Title *</Label>
                  <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-xl border border-border/60 bg-muted/10 p-3">
                <div>
                  <div className="text-sm font-medium">Published</div>
                  <div className="text-xs text-muted-foreground">If off, the public page returns 404.</div>
                </div>
                <Switch checked={Boolean(form.isPublished)} onCheckedChange={(v) => setForm((f) => ({ ...f, isPublished: v }))} />
              </div>

              <Separator className="my-4 bg-border/60" />

              <div>
                <Label>Body</Label>
                <Textarea
                  rows={16}
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                  placeholder="Write content here… (plain text or markdown-style)"
                />
              </div>
            </div>

            <div className="border-t border-border/60 p-5 sm:p-6">
              <div className="flex gap-2">
                <Button variant="outline" className="w-full" onClick={() => setOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button className="w-full" onClick={save} disabled={saving}>
                  {saving ? "Saving..." : editing ? "Save changes" : "Create page"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete page?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the page.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}