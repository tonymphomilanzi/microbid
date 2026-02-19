import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { Separator } from "../../components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
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
import { streamsService } from "../../services/streams.service";
import { useToast } from "../../hooks/use-toast";
import { Eye, Plus, Trash2, Pencil, UploadCloud, Loader2 } from "lucide-react";

function formatViews(n) {
  const v = Number(n || 0);
  if (!Number.isFinite(v) || v < 0) return "0";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`.replace(".0", "");
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`.replace(".0", "");
  return String(v);
}

export default function AdminStreams() {
  const { toast } = useToast();

  const coverInputRef = useRef(null);
  const videoInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [streams, setStreams] = useState([]);
  const [error, setError] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  const [form, setForm] = useState({
    title: "",
    caption: "",
    coverImageUrl: "",
    videoUrl: "",
    isActive: true,
    viewsCount: "0",
  });

  const canSave = useMemo(() => {
    return (
      form.title.trim() &&
      form.coverImageUrl.trim() &&
      form.videoUrl.trim() &&
      !saving &&
      !uploadingCover &&
      !uploadingVideo
    );
  }, [form, saving, uploadingCover, uploadingVideo]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await streamsService.adminListStreams();
      setStreams(res.streams ?? []);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to load streams");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({
      title: "",
      caption: "",
      coverImageUrl: "",
      videoUrl: "",
      isActive: true,
      viewsCount: "0",
    });
    setOpen(true);
  }

  function openEdit(s) {
    setEditing(s);
    setForm({
      title: s.title ?? "",
      caption: s.caption ?? "",
      coverImageUrl: s.coverImageUrl ?? "",
      videoUrl: s.videoUrl ?? "",
      isActive: Boolean(s.isActive),
      viewsCount: String(s.viewsCount ?? 0),
    });
    setOpen(true);
  }

  async function onUploadCoverFile(file) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file." });
      return;
    }

    setUploadingCover(true);
    try {
      const res = await streamsService.uploadCoverImage(file);
      if (!res?.url) throw new Error("Upload succeeded but missing url");
      setForm((f) => ({ ...f, coverImageUrl: res.url }));
    } catch (e) {
      toast({
        title: "Cover upload failed",
        description: e?.response?.data?.message || e.message || "Try again.",
      });
    } finally {
      setUploadingCover(false);
    }
  }

  async function onUploadVideoFile(file) {
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast({ title: "Invalid file", description: "Please select a video file." });
      return;
    }

    setUploadingVideo(true);
    try {
      const res = await streamsService.uploadVideo(file);
      if (!res?.url) throw new Error("Upload succeeded but missing url");
      setForm((f) => ({ ...f, videoUrl: res.url }));
    } catch (e) {
      toast({
        title: "Video upload failed",
        description: e?.response?.data?.message || e.message || "Try again.",
      });
    } finally {
      setUploadingVideo(false);
    }
  }

  async function save() {
    if (!canSave) return;

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        caption: form.caption.trim() ? form.caption.trim() : null,
        coverImageUrl: form.coverImageUrl.trim(),
        videoUrl: form.videoUrl.trim(),
        isActive: Boolean(form.isActive),
        viewsCount: Math.trunc(Number(form.viewsCount || 0)),
      };

      if (editing?.id) {
        await streamsService.adminUpdateStream(editing.id, payload);
        toast({ title: "Saved", description: "Stream updated." });
      } else {
        await streamsService.adminCreateStream(payload);
        toast({ title: "Created", description: "Stream created." });
      }

      setOpen(false);
      await load();
    } catch (e) {
      toast({
        title: "Save failed",
        description: e?.response?.data?.message || e.message || "Try again.",
      });
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
      await streamsService.adminDeleteStream(deletingId);
      toast({ title: "Deleted", description: "Stream removed." });
      setConfirmDeleteOpen(false);
      setDeletingId(null);
      await load();
    } catch (e) {
      toast({
        title: "Delete failed",
        description: e?.response?.data?.message || e.message || "Try again.",
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Streams</h1>
          <p className="text-sm text-muted-foreground">
            Upload short videos. Public users can watch and generate views.
          </p>
        </div>

        <Button className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New stream
        </Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : error ? (
        <Card className="border-border/60 bg-card/60">
          <CardContent className="p-5">
            <div className="text-sm font-medium">Could not load</div>
            <div className="mt-1 text-sm text-destructive">{error}</div>
            <div className="mt-4">
              <Button variant="outline" onClick={load}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : streams.length === 0 ? (
        <Card className="border-border/60 bg-card/60">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No streams yet. Click “New stream”.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {streams.map((s) => (
            <div key={s.id} className="group">
              <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-muted/10 aspect-[9/16]">
                <img
                  src={s.coverImageUrl}
                  alt={s.title}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                  loading="lazy"
                />

                <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] text-white backdrop-blur">
                  <Eye className="h-3.5 w-3.5" />
                  {formatViews(s.viewsCount)}
                </div>

                <div className="absolute left-2 top-2">
                  <Badge
                    variant="outline"
                    className={[
                      "rounded-full border-border/60 bg-black/40 text-white backdrop-blur",
                      s.isActive ? "" : "opacity-80",
                    ].join(" ")}
                  >
                    {s.isActive ? "Active" : "Hidden"}
                  </Badge>
                </div>

                <div className="absolute inset-x-0 bottom-0 p-2">
                  <div className="rounded-xl bg-gradient-to-t from-black/75 via-black/20 to-transparent p-2">
                    <div className="text-sm font-semibold text-white line-clamp-2 drop-shadow">
                      {s.title}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <Button size="sm" variant="outline" className="gap-2" onClick={() => openEdit(s)}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={() => askDelete(s.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[720px] border-border/60 bg-card/80 backdrop-blur">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit stream" : "New stream"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <Label>Title *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Short title"
                  disabled={saving}
                />
              </div>

              <div>
                <Label>Caption (optional)</Label>
                <Textarea
                  rows={4}
                  value={form.caption}
                  onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))}
                  placeholder="Optional description"
                  disabled={saving}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/10 p-3">
                <div>
                  <div className="text-sm font-medium">Active</div>
                  <div className="text-xs text-muted-foreground">If disabled, it won’t show to the public.</div>
                </div>
                <Switch
                  checked={Boolean(form.isActive)}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                  disabled={saving}
                />
              </div>

              <div>
                <Label>Views (admin override)</Label>
                <Input
                  inputMode="numeric"
                  value={form.viewsCount}
                  onChange={(e) => setForm((f) => ({ ...f, viewsCount: e.target.value }))}
                  placeholder="0"
                  disabled={saving}
                />
                <div className="mt-1 text-xs text-muted-foreground">
                  You can manually set views. Public views will also accumulate.
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Cover */}
              <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Cover image *</div>
                    <div className="text-xs text-muted-foreground">Used for image thumbnail.</div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    disabled={uploadingCover || saving}
                    onClick={() => coverInputRef.current?.click()}
                  >
                    {uploadingCover ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UploadCloud className="h-4 w-4" />
                    )}
                    Upload
                  </Button>

                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingCover || saving}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = ""; // allow same file re-select
                      await onUploadCoverFile(f);
                    }}
                  />
                </div>

                <div className="mt-3">
                  {form.coverImageUrl ? (
                    <div className="overflow-hidden rounded-xl border border-border/60 bg-background aspect-[9/16] max-w-[220px]">
                      <img src={form.coverImageUrl} alt="Cover preview" className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">No cover uploaded yet.</div>
                  )}
                </div>
              </div>

              {/* Video */}
              <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Video *</div>
                    <div className="text-xs text-muted-foreground">Upload a short mp4/mov.</div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    disabled={uploadingVideo || saving}
                    onClick={() => videoInputRef.current?.click()}
                  >
                    {uploadingVideo ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UploadCloud className="h-4 w-4" />
                    )}
                    Upload
                  </Button>

                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    disabled={uploadingVideo || saving}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = ""; // allow same file re-select
                      await onUploadVideoFile(f);
                    }}
                  />
                </div>

                <div className="mt-3">
                  {form.videoUrl ? (
                    <div className="overflow-hidden rounded-xl border border-border/60 bg-black aspect-[9/16] max-w-[220px]">
                      <video src={form.videoUrl} className="h-full w-full object-cover" controls playsInline muted />
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">No video uploaded yet.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Separator className="bg-border/60" />

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="w-full" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" className="w-full" onClick={save} disabled={!canSave}>
              {saving ? "Saving..." : editing ? "Save changes" : "Create stream"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete stream?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the stream and its view records.
            </AlertDialogDescription>
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