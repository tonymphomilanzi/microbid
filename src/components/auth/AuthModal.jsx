import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useAuth } from "../../context/AuthContext";
import { auth } from "../../firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";

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

  return (
    <Dialog open={authModalOpen} onOpenChange={(o) => !o && closeAuthModal()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Login to continue</DialogTitle>
        </DialogHeader>

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