import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatFCFA } from "@/lib/queue";

export const Route = createFileRoute("/ticket/$ticketId")({
  head: () => ({ meta: [{ title: "Ton ticket — Barber_Pro" }] }),
  component: Ticket,
});

type Entry = {
  id: string; barber_id: string; shop_id: string; service_id: string | null;
  client_name: string; status: string; position: number; created_at: string;
};

function Ticket() {
  const { ticketId } = Route.useParams();
  const nav = useNavigate();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [service, setService] = useState<{ name: string; price: number; duration_minutes: number } | null>(null);
  const [livePosition, setLivePosition] = useState(0);
  const [estMinutes, setEstMinutes] = useState(0);
  const [shopName, setShopName] = useState("");

  const reload = useCallback(async () => {
    const { data: e } = await supabase.from("queue_entries").select("*").eq("id", ticketId).maybeSingle();
    if (!e) return;
    setEntry(e as Entry);
    if (e.service_id) {
      const { data: s } = await supabase.from("services").select("name,price,duration_minutes").eq("id", e.service_id).maybeSingle();
      setService(s as typeof service);
    }
    const { data: shop } = await supabase.from("shops").select("name").eq("id", e.shop_id).maybeSingle();
    if (shop) setShopName(shop.name);

    // people ahead
    const { data: ahead } = await supabase.from("queue_entries")
      .select("id,service_id,created_at,status")
      .eq("barber_id", e.barber_id)
      .in("status", ["waiting", "in_progress"])
      .order("created_at", { ascending: true });
    const idx = (ahead ?? []).findIndex(x => x.id === e.id);
    setLivePosition(idx >= 0 ? idx + 1 : 0);
    const aheadList = idx > 0 ? (ahead ?? []).slice(0, idx) : [];
    let minutes = 0;
    for (const a of aheadList) {
      if (a.service_id) {
        const { data: s } = await supabase.from("services").select("duration_minutes").eq("id", a.service_id).maybeSingle();
        minutes += s?.duration_minutes ?? 20;
      } else minutes += 20;
    }
    setEstMinutes(minutes);
  }, [ticketId]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const ch = supabase.channel(`ticket-${ticketId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_entries" }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ticketId, reload]);

  async function leave() {
    if (!entry) return;
    await supabase.from("queue_entries").update({ status: "cancelled" }).eq("id", entry.id);
    nav({ to: "/" });
  }

  if (!entry) return <div className="min-h-screen bg-background grid place-items-center text-muted-foreground">Chargement…</div>;

  const isYourTurn = entry.status === "in_progress";
  const isDone = entry.status === "done";
  const isCancelled = entry.status === "cancelled" || entry.status === "skipped";
  const progressTotal = livePosition + 1;
  const progress = progressTotal > 0 ? Math.max(5, ((progressTotal - livePosition) / progressTotal) * 100) : 100;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-sm bg-card border rounded-3xl overflow-hidden shadow-sm">
        <div className="bg-primary text-primary-foreground p-5 text-center">
          <div className="text-[11px] uppercase tracking-widest text-white/60">{shopName}</div>
          <div className="text-xs text-white/60 mt-1">Ton ticket</div>
        </div>

        <div className="p-6 text-center">
          {isDone ? (
            <>
              <div className="text-3xl font-semibold">Merci, à bientôt !</div>
              <p className="text-sm text-muted-foreground mt-2">Ton service est terminé.</p>
            </>

          ) : isCancelled ? (
            <>
              <div className="text-2xl font-semibold">Ticket annulé</div>
              <p className="text-sm text-muted-foreground mt-2">Tu n'es plus dans la file.</p>
            </>
          ) : isYourTurn ? (
            <>
              <div className="text-[11px] uppercase tracking-widest text-[color:var(--success)] mb-2">À toi !</div>
              <div className="text-4xl font-semibold">C'est ton tour !</div>
              <p className="text-sm text-muted-foreground mt-2">Présente-toi au barbier.</p>
            </>

          ) : (
            <>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">Position</div>
              <div className="text-7xl font-semibold tabular-nums">#{livePosition}</div>
              <p className="text-xs text-muted-foreground mt-2">{entry.client_name}</p>
            </>
          )}
        </div>

        <div className="border-t border-dashed mx-6" />

        <div className="p-6 space-y-3 text-sm">
          {service && (
            <>
              <Row label="Service" value={service.name} />
              <Row label="Prix" value={formatFCFA(service.price)} />
              <Row label="Durée" value={`${service.duration_minutes} min`} />
            </>
          )}
          {!isDone && !isCancelled && !isYourTurn && (
            <Row label="Temps estimé" value={estMinutes > 0 ? `~${estMinutes} min` : "Bientôt"} />
          )}
        </div>

        {!isDone && !isCancelled && (
          <div className="px-6 pb-5">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <div className="px-6 pb-6">
          {isDone || isCancelled ? (
            <Link to="/" className="block text-center w-full bg-primary text-primary-foreground py-3 rounded-2xl font-medium">
              Retour à l'accueil
            </Link>
          ) : (
            <button onClick={leave} className="w-full border border-destructive text-destructive py-3 rounded-2xl font-medium">
              Quitter la file
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
