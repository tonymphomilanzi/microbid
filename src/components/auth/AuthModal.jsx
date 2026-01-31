import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { useAuth } from "../../context/AuthContext";
import { auth } from "../../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { listingsService } from "../../services/listings.service";

function normalizeUsername(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

export default function AuthModal() {
  const navigate = useNavigate();
  const { authModalOpen, closeAuthModal, refreshMe } = useAuth();

  const [tab, setTab] = useState("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Signup username
  const [username, setUsername] = useState("");
  const normalizedUsername = useMemo(() => normalizeUsername(username), [username]);

  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState(null); // null | true | false
  const [suggestions, setSuggestions] = useState([]);
  const [msg, setMsg] = useState("");

  const [busy, setBusy] = useState(false);

  // Debounced username check (PUBLIC endpoint after you fix api/me.js)
  useEffect(() => {
    let t;

    async function run() {
      setMsg("");
      setSuggestions([]);
      setAvailable(null);

      if (tab !== "signup") return;
      if (!normalizedUsername) return;

      setChecking(true);
      try {
        const res = await listingsService.checkUsername(normalizedUsername);
        setAvailable(Boolean(res.available));
        setMsg(res.available ? "Username is available" : res.reason || "Username is taken");
        setSuggestions(res.suggestions || []);
      } catch (e) {
        setAvailable(null);
        setMsg(e?.response?.data?.message || e.message || "Failed to check username");
      } finally {
        setChecking(false);
      }
    }

    t = setTimeout(run, 450);
    return () => clearTimeout(t);
  }, [normalizedUsername, tab]);

  async function afterAuthRedirectIfNoUsername() {
    // ensure DB user exists/loaded
    const meRes = await listingsService.me();
    if (!meRes?.user?.username) {
      closeAuthModal();
      navigate("/dashboard?tab=settings");
      return true;
    }
    return false;
  }

  async function login() {
    setBusy(true);
    setMsg("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      await refreshMe?.();

      const redirected = await afterAuthRedirectIfNoUsername();
      if (!redirected) closeAuthModal();
    } catch (e) {
      setMsg(e?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function signup() {
    setBusy(true);
    setMsg("");

    if (!normalizedUsername) {
      setBusy(false);
      setMsg("Please choose a username.");
      return;
    }
    if (available !== true) {
      setBusy(false);
      setMsg("Please choose an available username.");
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email, password);

      // Save username after Firebase account creation
      await listingsService.setUsername(normalizedUsername);

      await refreshMe?.();
      closeAuthModal();
    } catch (e) {
      const code = e?.code || "";
      if (code === "auth/email-already-in-use") {
        setTab("login");
        setMsg("This email already has an account. Please login instead.");
      } else {
        setMsg(e?.message || "Sign up failed");
      }
    } finally {
      setBusy(false);
    }
  }

  const googleProvider = new GoogleAuthProvider();

  async function loginWithGoogle() {
    setBusy(true);
    setMsg("");
    try {
      await signInWithPopup(auth, googleProvider);
      await refreshMe?.();

      const redirected = await afterAuthRedirectIfNoUsername();
      if (!redirected) closeAuthModal();
    } catch (err) {
      if (String(err?.code).includes("popup")) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      console.error(err);
      setMsg(err?.message ?? "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  const usernameBadge = useMemo(() => {
    if (tab !== "signup" || !normalizedUsername) return null;
    if (checking) return <Badge variant="outline">Checking…</Badge>;
    if (available === true) return <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">Available</Badge>;
    if (available === false) return <Badge className="bg-destructive/15 text-destructive border border-destructive/20">Taken</Badge>;
    return null;
  }, [tab, normalizedUsername, checking, available]);

  return (
    <Dialog open={authModalOpen} onOpenChange={(o) => !o && closeAuthModal()}>
      <DialogContent className="border-border/60 bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle>Continue</DialogTitle>
        </DialogHeader>

        <Button variant="outline" className="w-full gap-2" onClick={loginWithGoogle} disabled={busy}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.9 6.1 29.7 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.1-.1-2.3-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.9 6.1 29.7 4 24 4c-7.7 0-14.4 4.3-17.7 10.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 10.1-2 13.7-5.1l-6.3-5.2C29.4 35.6 26.8 36 24 36c-5.3 0-9.8-3.4-11.4-8.1l-6.5 5C9.3 39.7 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.4 4.2-4.5 5.6l6.3 5.2C39 36.3 44 31.5 44 24c0-1.1-.1-2.3-.4-3.5z"/>
          </svg>
          Continue with Google
        </Button>

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border/60" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        {msg ? (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
            {msg}
          </div>
        ) : null}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Sign up</TabsTrigger>
          </TabsList>

          <div className="mt-4 space-y-3">
            {tab === "signup" ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Username (public) e.g. microbid_seller"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                  {usernameBadge}
                </div>
                {suggestions?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s) => (
                      <Button
                        key={s}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => setUsername(s)}
                      >
                        @{s}
                      </Button>
                    ))}
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Your email stays private. Username is shown publicly.
                </p>
              </div>
            ) : null}

            <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <TabsContent value="login" className="mt-4">
            <Button className="w-full" onClick={login} disabled={busy}>
              {busy ? "Logging in..." : "Login"}
            </Button>
          </TabsContent>

          <TabsContent value="signup" className="mt-4">
            <Button className="w-full" onClick={signup} disabled={busy || checking || available !== true}>
              {busy ? "Creating..." : "Create account"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}