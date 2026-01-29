import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useAuth } from "../../context/AuthContext";
import { auth } from "../../firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect } from "firebase/auth";

export default function AuthModal() {
  const { authModalOpen, closeAuthModal } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function login() {
    await signInWithEmailAndPassword(auth, email, password);
    closeAuthModal();
  }

  async function signup() {
    await createUserWithEmailAndPassword(auth, email, password);
    closeAuthModal();
  }


const googleProvider = new GoogleAuthProvider();

async function loginWithGoogle() {
  try {
    // Popup works best on desktop
    await signInWithPopup(auth, googleProvider);
    closeAuthModal();
  } catch (err) {
    // Fallback for some mobile browsers blocking popups
    if (String(err?.code).includes("popup")) {
      await signInWithRedirect(auth, googleProvider);
      return;
    }
    console.error(err);
    alert(err?.message ?? "Google sign-in failed");
  }
}

  return (
    <Dialog open={authModalOpen} onOpenChange={(o) => !o && closeAuthModal()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Login to continue</DialogTitle>
        </DialogHeader>



<Button variant="outline" className="w-full gap-2"  onClick={loginWithGoogle}>
  {/* Inline Google SVG (no extra icon libs) */}
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
    <span className="w-full border-t" />
  </div>
  <div className="relative flex justify-center text-xs uppercase">
    <span className="bg-background px-2 text-muted-foreground">or</span>
  </div>
</div>


        <Tabs defaultValue="login">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Sign up</TabsTrigger>
          </TabsList>

          <div className="mt-4 space-y-3">
            <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <TabsContent value="login" className="mt-4">
            <Button className="w-full" onClick={login}>
              Login
            </Button>
          </TabsContent>

          <TabsContent value="signup" className="mt-4">
            <Button className="w-full" onClick={signup}>
              Create account
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}