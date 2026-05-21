import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Scissors } from "lucide-react";

export const Route = createFileRoute("/shop/$shopId")({
  head: () => ({ meta: [{ title: "Boutique — Barber_Pro" }] }),
  component: ShopPublic,
});

type Shop = { id: string; name: string; description: string | null; is_open: boolean };
type Barber = { id: string; name: string; specialties: string | null };

function ShopPublic() {
  const { shopId } = Route.useParams();
  const [shop, setShop] = useState<Shop | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [queueCounts, setQueueCounts] = useState<Record<string, number>>({});

  const reload = useCallback(async () => {
    const { data: s } = await supabase.from("shops").select("*").eq("id", shopId).maybeSingle();
    setShop(s as Shop | null);
    const { data: bs } = await supabase.from("barbers").select("*").eq("shop_id", shopId).eq("is_active", true).order("created_at");
    setBarbers((bs ?? []) as Barber[]);
    const counts: Record<string, number> = {};
    for (const b of bs ?? []) {
      const { count } = await supabase.from("queue_entries").select("*", { count: "exact", head: true })
        .eq("barber_id", b.id).in("status", ["waiting", "in_progress"]);
      counts[b.id] = count ?? 0;
    }
    setQueueCounts(counts);
  }, [shopId]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const ch = supabase.channel(`shop-${shopId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_entries", filter: `shop_id=eq.${shopId}` },
        () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [shopId, reload]);

  const totalWaiting = Object.values(queueCounts).reduce((a, b) => a + b, 0);

  if (!shop) return <div className="min-h-screen bg-background grid place-items-center text-muted-foreground">Chargement…</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground px-5 py-6">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-white rounded-2xl grid place-items-center text-primary"><Scissors size={22} /></div>
            <div>
              <h1 className="text-lg font-semibold">{shop.name}</h1>
              <div className="text-xs text-white/60 flex items-center gap-2 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${shop.is_open ? "bg-[color:var(--success)]" : "bg-destructive"}`} />
                {shop.is_open ? "Ouvert" : "Fermé"}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-5">
            <Stat label="Barbiers" value={barbers.length} />
            <Stat label="En attente" value={totalWaiting} />
            <Stat label="État" value={shop.is_open ? "ON" : "OFF"} />
          </div>
        </div>
      </header>

      <main className="p-5 max-w-md mx-auto space-y-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground px-1">Choisis un barbier</div>
        {barbers.map(b => (
          <Link key={b.id} to="/shop/$shopId/join/$barberId" params={{ shopId, barberId: b.id }}
            className="bg-card border rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:border-primary transition-colors active:scale-[0.99]">
            <div className="w-11 h-11 bg-primary text-primary-foreground rounded-2xl grid place-items-center text-sm font-medium">
              {b.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">{b.name}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Users size={11} /> {queueCounts[b.id] ?? 0} en file
              </div>
            </div>
            <div className="text-xs text-muted-foreground">Rejoindre →</div>
          </Link>
        ))}
        {barbers.length === 0 && (
          <div className="bg-card border rounded-2xl p-5 text-center text-sm text-muted-foreground">
            Aucun barbier disponible.
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl py-3 text-center">
      <div className="text-base font-semibold">{value}</div>
      <div className="text-[10px] text-white/50 mt-0.5">{label}</div>
    </div>
  );
}
