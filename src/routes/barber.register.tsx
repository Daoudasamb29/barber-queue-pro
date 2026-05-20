import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/barber/register")({
  head: () => ({ meta: [{ title: "Inscription — Barber_Pro" }] }),
  component: RegisterPage,
});

function RegisterPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/barber/dashboard` },
    });
    setLoading(false);
    if (error) return setErr(error.message);
    nav({ to: "/barber/setup" });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold mb-1">Créer un compte</h1>
        <p className="text-sm text-muted-foreground mb-6">Réservé aux barbiers.</p>
        <form onSubmit={submit} className="space-y-3">
          <input type="email" required placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full bg-card border rounded-2xl px-4 py-3 outline-none" />
          <input type="password" required minLength={6} placeholder="Mot de passe (6+ caractères)" value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full bg-card border rounded-2xl px-4 py-3 outline-none" />
          {err && <p className="text-sm text-destructive">{err}</p>}
          <button disabled={loading}
            className="w-full bg-primary text-primary-foreground py-3 rounded-2xl font-medium disabled:opacity-60">
            {loading ? "..." : "Créer le compte"}
          </button>
        </form>
        <p className="text-sm text-muted-foreground text-center mt-6">
          Déjà inscrit ? <Link to="/barber/login" className="text-foreground underline">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
