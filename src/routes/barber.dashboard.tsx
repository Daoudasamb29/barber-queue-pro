import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { BarberHeader, BarberTabs } from "@/components/BarberHeader";
import { finishCurrent, skipCurrent, cancelCurrent } from "@/lib/queue";
import { Check, SkipForward, X, Clock } from "lucide-react";

export const Route = createFileRoute("/barber/dashboard")({
  head: () => ({ meta: [{ title: "Tableau de bord — Barber_Pro" }] }),
  component: Dashboard,
});

type Entry = {
  id: string;
  shop_id: string;
  barber_id: string;
  service_id: string | null;
  client_name: string;
  status: string;
  position: number;
  called_at: string | null;
  created_at: string;
};
type Barber = { id: string; name: string };

function Dashboard() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [shopId, setShopId] = useState<string | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [timer, setTimer] = useState(0);

  useEffect(() => { if (!loading && !user) nav({ to: "/barber/login" }); }, [loading, user, nav]);

  // load shop + barbers
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: shops } = await supabase.from("shops").select("id").eq("owner_id", user.id).limit(1);
      const shop = shops?.[0];
      if (!shop) { nav({ to: "/barber/setup" }); return; }
      setShopId(shop.id);
      const { data: bs } = await supabase.from("barbers").select("id,name").eq("shop_id", shop.id).order("created_at");
      setBarbers(bs ?? []);
      if (bs && bs[0]) setSelectedBarber(bs[0].id);
    })();
  }, [user, nav]);

  const reloadEntries = useCallback(async () => {
    if (!selectedBarber) return;
    const { data } = await supabase
      .from("queue_entries")
      .select("*")
      .eq("barber_id", selectedBarber)
      .in("status", ["waiting", "in_progress"])
      .order("created_at", { ascending: true });
    setEntries((data ?? []) as Entry[]);
  }, [selectedBarber]);

  useEffect(() => { reloadEntries(); }, [reloadEntries]);

  // Realtime
  useEffect(() => {
    if (!selectedBarber) return;
    const ch = supabase
      .channel(`queue-${selectedBarber}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_entries", filter: `barber_id=eq.${selectedBarber}` },
        () => reloadEntries())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedBarber, reloadEntries]);

  const current = entries.find(e => e.status === "in_progress") ?? null;
  const waiting = entries.filter(e => e.status === "waiting");

  // Timer
  useEffect(() => {
    if (!current?.called_at) { setTimer(0); return; }
    const start = new Date(current.called_at).getTime();
    const id = setInterval(() => setTimer(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [current?.called_at, current?.id]);

  async function doFinish() {
    if (!current) return;
    await finishCurrent(current);
    reloadEntries();
  }
  async function doSkip() { if (current) { await skipCurrent(current); reloadEntries(); } }
  async function doCancel() { if (current) { await cancelCurrent(current); reloadEntries(); } }

  async function callNext() {
    if (current || !waiting[0]) return;
    await supabase.from("queue_entries").update({ status: "in_progress", called_at: new Date().toISOString() }).eq("id", waiting[0].id);
    reloadEntries();
  }

  const mm = String(Math.floor(timer / 60)).padStart(2, "0");
  const ss = String(timer % 60).padStart(2, "0");

  return (
    <div className="min-h-screen bg-background">
      <BarberHeader sub="File d'attente" />
      <BarberTabs />

      <div className="p-5 space-y-4 max-w-md mx-auto">
        {barbers.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {barbers.map(b => (
              <button key={b.id} onClick={() => setSelectedBarber(b.id)}
                className={`px-3 py-1.5 rounded-xl text-xs border whitespace-nowrap ${selectedBarber === b.id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground"}`}>
                {b.name}
              </button>
            ))}
          </div>
        )}

        {/* Current client */}
        <div className="bg-card border rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Client en cours</div>
          {current ? (
            <>
              <div className="text-2xl font-semibold">{current.client_name}</div>
              <div className="mt-2 flex items-center gap-2 text-muted-foreground">
                <Clock size={14} />
                <span className="tabular-nums">{mm}:{ss}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-5">
                <button onClick={doFinish} className="bg-[color:var(--success)] text-white py-3 rounded-2xl text-sm font-medium flex items-center justify-center gap-1">
                  <Check size={16} /> Terminé
                </button>
                <button onClick={doSkip} className="bg-muted py-3 rounded-2xl text-sm font-medium flex items-center justify-center gap-1">
                  <SkipForward size={16} /> Passer
                </button>
                <button onClick={doCancel} className="bg-destructive text-destructive-foreground py-3 rounded-2xl text-sm font-medium flex items-center justify-center gap-1">
                  <X size={16} /> Annuler
                </button>
              </div>
            </>
          ) : (
            <div>
              <p className="text-muted-foreground text-sm">Aucun client en cours.</p>
              {waiting[0] && (
                <button onClick={callNext} className="mt-4 w-full bg-primary text-primary-foreground py-3 rounded-2xl font-medium">
                  Appeler {waiting[0].client_name}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Waiting */}
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground px-1 mb-2">
            File d'attente ({waiting.length})
          </div>
          <div className="space-y-2">
            {waiting.length === 0 && (
              <div className="bg-card border rounded-2xl p-5 text-sm text-muted-foreground text-center">
                Personne dans la file.
              </div>
            )}
            {waiting.map((e, i) => (
              <div key={e.id} className="bg-card border rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-muted grid place-items-center text-sm font-medium">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{e.client_name}</div>
                  <div className="text-xs text-muted-foreground">En attente</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
