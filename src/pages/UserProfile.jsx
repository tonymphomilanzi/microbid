import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import PageContainer from "../components/layout/PageContainer";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "../components/ui/drawer";

import ListingCard from "../components/listings/ListingCard";
import ShareSheet from "../components/shared/ShareSheet";
import UserAvatar from "../components/shared/UserAvatar";
import ChatDialog from "../components/chat/ChatDialog";
import { useAuth } from "../context/AuthContext";

import { BadgeCheck, MessageCircle, ExternalLink } from "lucide-react";
import axios from "axios";

const ONLINE_WINDOW_MS = 2 * 60 * 1000;
const isOnline = (ts) => (ts ? Date.now() - new Date(ts).getTime() < ONLINE_WINDOW_MS : false);

function VerifiedCheckWithOnline({ online }) {
  return (
    <span className="relative inline-flex h-4 w-4" title={online ? "Verified • Online" : "Verified • Offline"}>
      <BadgeCheck className="h-4 w-4 text-primary" />
      <span className="absolute inset-0 grid place-items-center">
        <span className={["h-1.5 w-1.5 rounded-full", "ring-2 ring-background", online ? "bg-emerald-400" : "bg-muted-foreground/40"].join(" ")} />
      </span>
    </span>
  );
}

function PlanBadge({ name }) {
  const config = {
    FREE: "bg-zinc-500/10 text-zinc-300 border-zinc-500/30",
    PRO: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    VIP: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    ADMIN: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  };
  return <Badge variant="outline" className={config[name?.toUpperCase()] || config.FREE}>{name || "FREE"}</Badge>;
}

export default function UserProfile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user: authUser, openAuthModal } = useAuth() || {};

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");

  const [chatOpen, setChatOpen] = useState(false);
  const [listingForChat, setListingForChat] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const isMe = useMemo(() => {
    const uid = authUser?.uid || authUser?.id;
    return uid && profile?.user?.id && uid === profile.user.id;
  }, [authUser, profile]);

  const online = isOnline(profile?.user?.lastActiveAt);
  const shareUrl = useMemo(
    () => `${window.location.origin}/users/${encodeURIComponent(username || "")}`,
    [username]
  );

  async function refresh() {
    setError(""); setLoading(true);
    try {
      const { data } = await axios.get("/api/listings", {
        params: { public: "userProfile", username },
      });
      setProfile(data);
      document.title = data?.user?.username ? `@${data.user.username} • Profile` : "Profile";
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [username]);

  const startChatForListing = (l) => {
    if (!authUser) return openAuthModal?.();
    setListingForChat(l);
    setChatOpen(true);
  };

  const handleHeaderMessage = () => {
    if (!authUser) return openAuthModal?.();
    const list = profile?.listings || [];
    if (list.length === 0) return; // nothing to chat about
    if (list.length === 1) return startChatForListing(list[0]);
    setPickerOpen(true); // choose listing context
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="py-8 space-y-4">
          <div className="h-20 w-full rounded-xl bg-muted/30 animate-pulse" />
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 rounded-xl bg-muted/20 animate-pulse" />
            ))}
          </div>
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <div className="py-8 space-y-4">
          <Card className="border-border/60 bg-card/60">
            <CardContent className="p-6">
              <div className="text-sm font-medium">Could not load profile</div>
              <div className="mt-1 text-sm text-muted-foreground">{error}</div>
              <div className="mt-4"><Button variant="outline" onClick={refresh}>Retry</Button></div>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    );
  }

  if (!profile?.user) {
    return (
      <PageContainer>
        <div className="py-8 space-y-4">
          <Card className="border-border/60 bg-card/60">
            <CardContent className="p-6">
              <div className="text-sm font-medium">User not found</div>
              <div className="mt-4"><Button asChild variant="outline"><Link to="/">Go home</Link></Button></div>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    );
  }

  const u = profile.user;

  return (
    <PageContainer>
      <div className="py-8 space-y-6">
        {/* Header */}
        <Card className="border-border/60 bg-card/60 backdrop-blur">
          <CardContent className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link to={`/users/${encodeURIComponent(u.username || "")}`} className="flex items-center gap-3" title={u.username ? `@${u.username}` : "User"}>
                <UserAvatar
                  src={u.avatarUrl}
                  alt={u.username ? `@${u.username}` : "User"}
                  size={56}
                  online={!u.isVerified && online}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-lg font-semibold hover:underline">@{u.username}</div>
                    {u.isVerified ? <VerifiedCheckWithOnline online={online} /> : null}
                    <PlanBadge name={u.tier} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {profile.counts?.activeListings ?? 0} Active {profile.counts?.activeListings === 1 ? "Listing" : "Listings"}
                  </div>
                </div>
              </Link>

              <div className="flex flex-wrap gap-2">
                <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                  <ShareSheet
                    url={shareUrl}
                    title={u.username ? `@${u.username}` : "Profile"}
                    text={`${u.username ? `Check out @${u.username}` : "View this profile"} on the marketplace`}
                  />
                </div>

                {isMe ? (
                  <Button asChild variant="outline" className="gap-2">
                    <Link to="/dashboard">
                      <ExternalLink className="h-4 w-4" />
                      Manage profile
                    </Link>
                  </Button>
                ) : (
                  <Button
                    onClick={handleHeaderMessage}
                    className="gap-2"
                    disabled={!profile.listings?.length}
                    title={!profile.listings?.length ? "No active listings to discuss" : "Message seller"}
                  >
                    <MessageCircle className="h-4 w-4" />
                    Message
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Listings grid (ACTIVE only) + inline Message CTA */}
        {profile.listings?.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {profile.listings.map((l) => (
              <div key={l.id} className="space-y-2">
                <ListingCard listing={l} />
                {!isMe ? (
                  <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => startChatForListing(l)}>
                    <MessageCircle className="h-4 w-4" />
                    Message about this listing
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <Card className="border-border/60 bg-card/60">
            <CardContent className="p-6 text-sm text-muted-foreground">
              No active listings yet.
            </CardContent>
          </Card>
        )}

        {/* Choose listing (if multiple) */}
        <Drawer open={pickerOpen} onOpenChange={setPickerOpen}>
          <DrawerContent className="max-h-[85vh]">
            <div className="mx-auto w-full max-w-2xl px-4 pb-4">
              <DrawerHeader className="px-0">
                <DrawerTitle>Select a listing to message about</DrawerTitle>
              </DrawerHeader>
              <div className="space-y-2">
                {(profile.listings || []).map((l) => (
                  <button
                    key={l.id}
                    className="w-full rounded-xl border border-border/60 bg-card/60 p-3 text-left hover:border-primary/30 hover:bg-muted/10"
                    onClick={() => {
                      setPickerOpen(false);
                      startChatForListing(l);
                    }}
                  >
                    <div className="font-medium truncate">{l.title}</div>
                    <div className="text-xs text-muted-foreground">Price ${l.price} • {l.platform}</div>
                  </button>
                ))}
              </div>
            </div>
          </DrawerContent>
        </Drawer>

        {/* Chat (uses listing context) */}
        <ChatDialog
          open={chatOpen}
          onOpenChange={setChatOpen}
          currentUser={authUser}
          listing={listingForChat}
        />
      </div>
    </PageContainer>
  );
}