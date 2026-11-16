import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/password-input";
import { CollaborationHero } from "@/components/collaboration-hero";
import { broadcastAuthChange } from "@/lib/auth-sync";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Admin sign in — INNOVEDGE Assessor" },
      { name: "description", content: "Sign in to the INNOVEDGE AI project evaluation admin console." },
      { property: "og:title", content: "Admin sign in — INNOVEDGE Assessor" },
      { property: "og:description", content: "Sign in to the INNOVEDGE AI project evaluation admin console." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    if (mode === "login") {
      try {
        const { data: authRes, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error || !authRes?.user) {
          setBusy(false);
          return toast.error(error?.message || "Invalid credentials.");
        }

        try {
          await supabase.rpc("claim_first_admin");
        } catch (rpcErr) {
          console.warn("claim_first_admin sync:", rpcErr);
        }

        broadcastAuthChange({
          type: "SIGN_IN",
          userId: authRes.user.id,
          email: authRes.user.email,
        });
        setBusy(false);
        toast.success(`Signed in as ${authRes.user.email}`);
        navigate({ to: "/dashboard" });
      } catch (err) {
        setBusy(false);
        return toast.error((err as Error).message || "Authentication error.");
      }
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setBusy(false);
      if (error) return toast.error(error.message);
      toast.success("If that account exists, a reset link is on its way.");
      setMode("login");
    }
  };

  return (
    <div className="w-full min-h-screen md:grid md:grid-cols-2 bg-background">
      <style>{`
        input[type="password"]::-ms-reveal,
        input[type="password"]::-ms-clear {
          display: none;
        }
      `}</style>

      {/* Left Column: Admin Sign In Form */}
      <div className="flex min-h-screen items-center justify-center p-6 sm:p-10 md:p-12 border-r border-border/40">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto grid w-full max-w-[380px] gap-6"
        >
          {/* Header branding */}
          <div className="flex flex-col items-center text-center">
            <img
              src="/innovedge-logo.png"
              alt="INNOVEDGE Logo"
              className="size-16 object-contain drop-shadow-md mb-2"
            />
            <div className="font-display text-lg font-bold tracking-wider text-foreground">
              INNOVEDGE
            </div>
            <div className="text-[10px] tracking-widest uppercase font-semibold text-primary/80">
              Innovation • Entrepreneurship • Excellence
            </div>
          </div>

          <div className="flex flex-col items-center gap-1.5 text-center">
            <h1 className="text-2xl font-bold tracking-tight">
              {mode === "login" ? "Admin Sign In" : "Reset Password"}
            </h1>
            <p className="text-balance text-xs sm:text-sm text-muted-foreground">
              Restricted to authorised evaluation administrators
            </p>
          </div>

          {/* Form */}
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">ID (email)</Label>
              <Input
                id="email"
                type="email"
                required
                maxLength={255}
                placeholder="TeamInoSap26@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {mode !== "forgot" && (
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pw">Password</Label>
                  <Button
                    type="button"
                    variant="link"
                    className="p-0 h-auto text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setPassword("");
                      setMode("forgot");
                    }}
                  >
                    Forgot password?
                  </Button>
                </div>
                <PasswordInput
                  id="pw"
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}

            <Button type="submit" className="w-full mt-2 font-medium" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin mr-2" />}
              {mode === "login" ? "Sign In" : "Send reset link"}
            </Button>
          </form>

          {mode === "forgot" && (
            <div className="text-center text-sm">
              <Button
                variant="link"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setMode("login")}
              >
                Back to sign in
              </Button>
            </div>
          )}
        </motion.div>
      </div>

      {/* Right Column: 3D Animated INNOVEDGE ✕ NEXUS Collaboration Showcase */}
      <div className="hidden md:block relative h-full min-h-screen">
        <CollaborationHero />
      </div>
    </div>
  );
}
