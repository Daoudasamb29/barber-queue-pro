import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LogOut } from "lucide-react";

export function BarberHeader({ title, sub }: { title?: string; sub?: string }) {
  const nav = useNavigate();
  return (
    <header className="bg-primary text-primary-foreground px-5 py-4 flex items-center justify-between">
      <Link to="/barber/dashboard" className="flex flex-col leading-tight">
        <span className="font-semibold tracking-tight">Barber_Pro</span>
        {sub && <span className="text-xs text-white/50">{sub}</span>}
      </Link>
      {title && <div className="text-sm text-white/70">{title}</div>}
      <button
        onClick={async () => { await supabase.auth.signOut(); nav({ to: "/" }); }}
        className="p-2 rounded-xl bg-white/10 hover:bg-white/20"
        aria-label="Déconnexion"
      >
        <LogOut size={16} />
      </button>
    </header>
  );
}

export function BarberTabs() {
  return (
    <nav className="flex gap-2 px-5 py-3 bg-background border-b">
      <TabLink to="/barber/dashboard" label="File" />
      <TabLink to="/barber/setup" label="Boutique" />
      <TabLink to="/barber/accounting" label="Compta" />
    </nav>
  );
}

function TabLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="px-3 py-1.5 rounded-xl text-xs border bg-card text-muted-foreground"
      activeProps={{ className: "px-3 py-1.5 rounded-xl text-xs bg-primary text-primary-foreground border border-primary" }}
    >
      {label}
    </Link>
  );
}
