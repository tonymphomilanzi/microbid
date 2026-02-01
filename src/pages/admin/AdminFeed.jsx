import { useEffect, useMemo, useState } from "react";
import { adminService } from "../../services/admin.service";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import ConfirmDeleteDialog from "../../components/ui/ConfirmDeleteDialog";
import ImageUpload from "../../components/forms/ImageUpload";

const TAGS = ["NEW", "UPDATE", "CHANGELOG"];

function AuthorHandle({ username }) {
  if (username) return <span>@{username}</span>;
  return <span className="select-none blur-[3px]">@private_user</span>;
}

export default function AdminFeed() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState("");

  // create form
  const [form, setForm] = useState({
    title: "",
    body: "",
    category: "",
    tags: ["UPDATE"],
    image: "",
  });
  const [creating, setCreating] = useState(false);

  // edit
  const [editingId, setEditingId] = useState("");
  const editingPost = useMemo(() => posts.find((p) => p.id === editingId), [posts, editingId]);
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);

  // delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function load() {
    setError("");
    setLoading(true);
    try {
      const { posts } = await adminService.getFeedPosts({ q: q || undefined });
      setPosts(posts || []);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to load feed posts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createPost() {
    if (!form.title.trim() || !form.body.trim()) {
      setError("Title and body are required.");
      return;
    }

    setCreating(true);
    try {
      await adminService.createFeedPost({
        title: form.title.trim(),
        body: form.body.trim(),
        category: form.category.trim() || null,
        tags: form.tags,
        image: form.image || null,
      });

      setForm({ title: "", body: "", category: "", tags: ["UPDATE"], image: "" });
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to create post");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(post) {
    setEditingId(post.id);
    setEditForm({
      title: post.title || "",
      body: post.body || "",
      category: post.category || "",
      tags: post.tags || [],
      image: post.image || "",
    });
  }

  async function saveEdit() {
    if (!editingId || !editForm) return;

    setSaving(true);
    try {
      await adminService.updateFeedPost(editingId, {
        title: editForm.title.trim(),
        body: editForm.body.trim(),
        category: editForm.category.trim() || null,
        tags: editForm.tags,
        image: editForm.image || null,
      });
      setEditingId("");
      setEditForm(null);
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to update post");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete?.id) return;
    setDeleteLoading(true);
    try {
      await adminService.deleteFeedPost(toDelete.id);
      setDeleteOpen(false);
      setToDelete(null);
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to delete post");
    } finally {
      setDeleteLoading(false);
    }
  }

  function toggleTag(currentTags, tag) {
    const set = new Set(currentTags || []);
    if (set.has(tag)) set.delete(tag);
    else set.add(tag);
    return Array.from(set);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Feed</h1>
        <p className="text-sm text-muted-foreground">
          Post news, updates, and changelogs for all users.
        </p>
      </div>

      {error ? (
        <Card className="border-border/60 bg-card/60">
          <CardContent className="p-4 text-sm text-muted-foreground">{error}</CardContent>
        </Card>
      ) : null}

      {/* Create */}
      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardContent className="p-5 space-y-4">
          <div className="text-sm font-semibold">Create post</div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <Input
              placeholder="Category (e.g. Product, Escrow, Community)"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            />
          </div>

          <Textarea
            placeholder="Write your update..."
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            rows={6}
          />

          <div className="flex flex-wrap gap-2">
            {TAGS.map((t) => {
              const selected = form.tags?.includes(t);
              return (
                <Button
                  key={t}
                  type="button"
                  size="sm"
                  variant={selected ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() => setForm((f) => ({ ...f, tags: toggleTag(f.tags, t) }))}
                >
                  {t}
                </Button>
              );
            })}
          </div>

          <div className="grid gap-4 md:grid-cols-2 md:items-start">
            <div className="space-y-2">
              <div className="text-sm font-medium">Optional image</div>
              <ImageUpload value={form.image} onChange={(url) => setForm((f) => ({ ...f, image: url }))} />
            </div>

            <div className="flex md:justify-end md:items-end">
              <Button onClick={createPost} disabled={creating}>
                {creating ? "Posting..." : "Publish post"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="flex gap-2">
        <Input placeholder="Search posts..." value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="outline" onClick={load} disabled={loading}>
          Search
        </Button>
      </div>

      {/* List */}
      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : posts.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No posts yet.</div>
          ) : (
            <div className="divide-y divide-border/60">
              {posts.map((p) => (
                <div key={p.id} className="p-4 space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium truncate">{p.title}</div>
                        {(p.tags || []).map((t) => (
                          <Badge key={t} variant="outline" className="border-border/60 bg-muted/20">
                            {t}
                          </Badge>
                        ))}
                        {p.category ? (
                          <Badge variant="outline" className="border-border/60 bg-muted/20">
                            {p.category}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        By <AuthorHandle username={p.author?.username} /> •{" "}
                        {new Date(p.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => startEdit(p)}>
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setToDelete(p);
                          setDeleteOpen(true);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>

                  {p.image ? (
                    <div className="overflow-hidden rounded-lg border border-border/60">
                      <img src={p.image} alt={p.title} className="w-full max-h-[260px] object-cover" />
                    </div>
                  ) : null}

                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">{p.body}</div>

                  {/* Edit panel */}
                  {editingId === p.id && editForm ? (
                    <Card className="border-border/60 bg-muted/10">
                      <CardContent className="p-4 space-y-3">
                        <div className="text-sm font-semibold">Edit post</div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <Input
                            value={editForm.title}
                            onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                          />
                          <Input
                            value={editForm.category}
                            onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                          />
                        </div>

                        <Textarea
                          value={editForm.body}
                          onChange={(e) => setEditForm((f) => ({ ...f, body: e.target.value }))}
                          rows={5}
                        />

                        <div className="flex flex-wrap gap-2">
                          {TAGS.map((t) => {
                            const selected = editForm.tags?.includes(t);
                            return (
                              <Button
                                key={t}
                                type="button"
                                size="sm"
                                variant={selected ? "default" : "outline"}
                                className="rounded-full"
                                onClick={() =>
                                  setEditForm((f) => ({ ...f, tags: toggleTag(f.tags, t) }))
                                }
                              >
                                {t}
                              </Button>
                            );
                          })}
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 md:items-start">
                          <div className="space-y-2">
                            <div className="text-sm font-medium">Image</div>
                            <ImageUpload
                              value={editForm.image}
                              onChange={(url) => setEditForm((f) => ({ ...f, image: url }))}
                            />
                          </div>

                          <div className="flex gap-2 md:justify-end md:items-end">
                            <Button
                              variant="outline"
                              onClick={() => {
                                setEditingId("");
                                setEditForm(null);
                              }}
                              disabled={saving}
                            >
                              Cancel
                            </Button>
                            <Button onClick={saveEdit} disabled={saving}>
                              {saving ? "Saving..." : "Save"}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={(o) => {
          setDeleteOpen(o);
          if (!o) setToDelete(null);
        }}
        loading={deleteLoading}
        title="Delete post?"
        description={toDelete ? `Delete "${toDelete.title}"? This cannot be undone.` : "This cannot be undone."}
        confirmText="Delete"
        onConfirm={confirmDelete}
      />
    </div>
  );
}