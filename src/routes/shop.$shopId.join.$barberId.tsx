import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { joinQueue, formatFCFA } from "@/lib/queue";

export const Route = createFileRoute("/shop/$shopId/join/$barberId")({
  head: () => ({ meta: [{ title: "Rejoindre la file — Barber_Pro" }] }),
  component: JoinPage,
});

type Service = { id: string; name: string; price: number; duration_minutes: number; barber_id: string | null };
type Barber = { id: string; name: string };

function JoinPage() {
  const { shopId, barberId } = Route.useParams();
  const nav = useNavigate();
  const [barber, setBarber] = useState<Barber | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState<string>("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: b } = await supabase.from("barbers").select("id,name").eq("id", barberId).maybeSingle();
      setBarber(b as Barber | null);
      const { data: svcs } = await supabase.from("services").select("*").eq("shop_id", shopId).or(`barber_id.eq.${barberId},barber_id.is.null`);
      setServices((svcs ?? []) as Service[]);
      if (svcs?.[0]) setServiceId(svcs[0].id);
    })();
  }, [shopId, barberId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setSubmitting(true);
    try {
      const entry = await joinQueue({
        shop_id: shopId, barber_id: barberId,
        service_id: serviceId || null,
        client_name: name.trim(), client_phone: phone.trim() || null,
      });
      nav({ to: "/ticket/$ticketId", params: { ticketId: entry.id } });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally { setSubmitting(false); }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground px-5 py-5">
        <div className="max-w-md mx-auto">
          <Link to="/shop/$shopId" params={{ shopId }} className="text-xs text-white/60">← Retour</Link>
          <h1 className="text-lg font-semibold mt-1">Rejoindre la file</h1>
          {barber && <div className="text-xs text-white/60">avec {barber.name}</div>}
        </div>
      </header>

      <main className="p-5 max-w-md mx-auto">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground px-1 mb-2">Service</div>
            <div className="space-y-2">
              {services.map(s => (
                <label key={s.id} className={`block bg-card border rounded-2xl p-4 cursor-pointer ${serviceId === s.id ? "ring-2 ring-primary" : ""}`}>
                  <input type="radio" name="svc" value={s.id} checked={serviceId === s.id}
                    onChange={() => setServiceId(s.id)} className="hidden" />
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.duration_minutes} min</div>
                    </div>
                    <div className="text-sm font-medium">{formatFCFA(s.price)}</div>
                  </div>
                </label>
              ))}
              {services.length === 0 && (
                <div className="bg-card border rounded-2xl p-4 text-sm text-muted-foreground text-center">
                  Aucun service configuré.
                </div>
              )}
            </div>
          </div>

          <input required placeholder="Prénom" value={name} onChange={e => setName(e.target.value)}
            className="w-full bg-card border rounded-2xl px-4 py-3 outline-none" />
          <input type="tel" placeholder="Téléphone (optionnel)" value={phone} onChange={e => setPhone(e.target.value)}
            className="w-full bg-card border rounded-2xl px-4 py-3 outline-none" />

          {err && <p className="text-sm text-destructive">{err}</p>}

          <button disabled={submitting || !name || !serviceId}
            className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-medium disabled:opacity-50">
            {submitting ? "..." : "Rejoindre la file"}
          </button>
        </form>
      </main>
    </div>
  );
}
