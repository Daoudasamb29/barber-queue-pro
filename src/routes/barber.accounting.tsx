import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { BarberHeader, BarberTabs } from "@/components/BarberHeader";
import { formatFCFA } from "@/lib/queue";
import { Download, FileSpreadsheet } from "lucide-react";

export const Route = createFileRoute("/barber/accounting")({
  head: () => ({ meta: [{ title: "Comptabilité — Barber_Pro" }] }),
  component: Accounting,
});

type Payment = { id: string; client_name: string; service_name: string; amount: number; paid_at: string };
type Period = "day" | "week" | "month";

function range(period: Period) {
  const now = new Date();
  const start = new Date(now);
  if (period === "day") start.setHours(0, 0, 0, 0);
  else if (period === "week") { start.setDate(now.getDate() - 7); start.setHours(0, 0, 0, 0); }
  else { start.setDate(now.getDate() - 30); start.setHours(0, 0, 0, 0); }
  const prevStart = new Date(start);
  const span = now.getTime() - start.getTime();
  prevStart.setTime(start.getTime() - span);
  return { start, prevStart, end: now };
}

function Accounting() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [shopId, setShopId] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("day");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [prevPayments, setPrevPayments] = useState<Payment[]>([]);
  const [weekly, setWeekly] = useState<{ day: string; total: number }[]>([]);

  useEffect(() => { if (!loading && !user) nav({ to: "/barber/login" }); }, [loading, user, nav]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("shops").select("id").eq("owner_id", user.id).limit(1);
      if (data?.[0]) setShopId(data[0].id);
    })();
  }, [user]);

  useEffect(() => {
    if (!shopId) return;
    const { start, prevStart, end } = range(period);
    (async () => {
      const [{ data: cur }, { data: prev }] = await Promise.all([
        supabase.from("payments").select("*").eq("shop_id", shopId).gte("paid_at", start.toISOString()).lte("paid_at", end.toISOString()).order("paid_at", { ascending: false }),
        supabase.from("payments").select("*").eq("shop_id", shopId).gte("paid_at", prevStart.toISOString()).lt("paid_at", start.toISOString()),
      ]);
      setPayments((cur ?? []) as Payment[]);
      setPrevPayments((prev ?? []) as Payment[]);

      // last 7 days
      const days: { day: string; total: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
        const d2 = new Date(d); d2.setDate(d.getDate() + 1);
        const { data: dp } = await supabase.from("payments").select("amount").eq("shop_id", shopId)
          .gte("paid_at", d.toISOString()).lt("paid_at", d2.toISOString());
        const total = (dp ?? []).reduce((a: number, b: { amount: number }) => a + b.amount, 0);
        days.push({ day: d.toLocaleDateString("fr-FR", { weekday: "short" }), total });
      }
      setWeekly(days);
    })();
  }, [shopId, period]);

  const totals = useMemo(() => {
    const revenue = payments.reduce((a, b) => a + b.amount, 0);
    const prev = prevPayments.reduce((a, b) => a + b.amount, 0);
    const variation = prev === 0 ? (revenue > 0 ? 100 : 0) : ((revenue - prev) / prev) * 100;
    const clients = payments.length;
    const avg = clients ? Math.round(revenue / clients) : 0;
    return { revenue, variation, clients, avg };
  }, [payments, prevPayments]);

  const maxBar = Math.max(1, ...weekly.map(w => w.total));

  async function exportPDF() {
    const { default: jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text("Barber_Pro — Comptabilité", 14, 18);
    doc.setFontSize(10); doc.text(`Période : ${period} · Revenus : ${formatFCFA(totals.revenue)}`, 14, 26);
    autoTable(doc, {
      startY: 32,
      head: [["Client", "Service", "Montant", "Date"]],
      body: payments.map(p => [p.client_name, p.service_name, formatFCFA(p.amount), new Date(p.paid_at).toLocaleString("fr-FR")]),
    });
    doc.save(`barber-pro-${period}.pdf`);
  }
  async function exportExcel() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(payments.map(p => ({
      Client: p.client_name, Service: p.service_name, Montant: p.amount,
      Date: new Date(p.paid_at).toLocaleString("fr-FR"),
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Paiements");
    XLSX.writeFile(wb, `barber-pro-${period}.xlsx`);
  }

  return (
    <div className="min-h-screen bg-background">
      <BarberHeader sub="Comptabilité" />
      <BarberTabs />

      <div className="p-5 space-y-4 max-w-md mx-auto pb-16">
        <div className="flex gap-2">
          {(["day", "week", "month"] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`flex-1 py-2 rounded-2xl text-xs font-medium border ${period === p ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground"}`}>
              {p === "day" ? "Jour" : p === "week" ? "Semaine" : "Mois"}
            </button>
          ))}
        </div>

        <div className="bg-card border rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Revenus</div>
          <div className="text-3xl font-semibold mt-1">{formatFCFA(totals.revenue)}</div>
          <div className={`text-xs mt-1 ${totals.variation >= 0 ? "text-[color:var(--success)]" : "text-destructive"}`}>
            {totals.variation >= 0 ? "+" : ""}{totals.variation.toFixed(1)}% vs période précédente
          </div>

          <div className="flex items-end gap-1.5 h-16 mt-5">
            {weekly.map((w, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-primary rounded-t-md" style={{ height: `${(w.total / maxBar) * 100}%` }} />
                <div className="text-[9px] text-muted-foreground">{w.day}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border rounded-2xl p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Clients</div>
            <div className="text-xl font-semibold mt-1">{totals.clients}</div>
          </div>
          <div className="bg-card border rounded-2xl p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Moy. / client</div>
            <div className="text-xl font-semibold mt-1">{formatFCFA(totals.avg)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={exportPDF} className="bg-card border py-3 rounded-2xl text-sm font-medium flex items-center justify-center gap-2">
            <Download size={16} /> PDF
          </button>
          <button onClick={exportExcel} className="bg-card border py-3 rounded-2xl text-sm font-medium flex items-center justify-center gap-2">
            <FileSpreadsheet size={16} /> Excel
          </button>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground px-1 mb-2">Transactions</div>
          <div className="space-y-2">
            {payments.length === 0 && (
              <div className="bg-card border rounded-2xl p-5 text-center text-sm text-muted-foreground">
                Aucune transaction sur la période.
              </div>
            )}
            {payments.map(p => (
              <div key={p.id} className="bg-card border rounded-2xl p-4 flex items-center gap-3">
                <div className="flex-1">
                  <div className="font-medium text-sm">{p.client_name}</div>
                  <div className="text-xs text-muted-foreground">{p.service_name} · {new Date(p.paid_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{formatFCFA(p.amount)}</div>
                  <span className="text-[10px] bg-[color:var(--success)]/15 text-[color:var(--success)] px-2 py-0.5 rounded-full">Payé</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
