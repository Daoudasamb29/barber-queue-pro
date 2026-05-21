import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { BarberHeader, BarberTabs } from "@/components/BarberHeader";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { Trash2, Plus, Download, FileText } from "lucide-react";
import { formatFCFA } from "@/lib/queue";
import { useRef } from "react";
import jsPDF from "jspdf";


export const Route = createFileRoute("/barber/setup")({
  head: () => ({ meta: [{ title: "Boutique — Barber_Pro" }] }),
  component: Setup,
});

type Shop = { id: string; name: string; description: string | null; address: string | null; phone: string | null; opening_hours: string | null; is_open: boolean };
type Barber = { id: string; name: string; specialties: string | null };
type Service = { id: string; barber_id: string | null; name: string; price: number; duration_minutes: number };

function Setup() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [shop, setShop] = useState<Shop | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [name, setName] = useState("");
  const [newBarber, setNewBarber] = useState("");
  const [newSvc, setNewSvc] = useState({ name: "", price: 0, duration_minutes: 30, barber_id: "" });

  useEffect(() => { if (!loading && !user) nav({ to: "/barber/login" }); }, [loading, user, nav]);

  const reload = useCallback(async () => {
    if (!user) return;
    const { data: shops } = await supabase.from("shops").select("*").eq("owner_id", user.id).limit(1);
    const s = shops?.[0] as Shop | undefined;
    setShop(s ?? null);
    if (s) {
      const [{ data: bs }, { data: svcs }] = await Promise.all([
        supabase.from("barbers").select("*").eq("shop_id", s.id).order("created_at"),
        supabase.from("services").select("*").eq("shop_id", s.id).order("created_at"),
      ]);
      setBarbers((bs ?? []) as Barber[]);
      setServices((svcs ?? []) as Service[]);
    }
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  async function createShop(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("shops").insert({ owner_id: user.id, name });
    if (!error) { setName(""); reload(); }
  }

  async function updateShop(patch: Partial<Shop>) {
    if (!shop) return;
    await supabase.from("shops").update(patch).eq("id", shop.id);
    reload();
  }

  async function addBarber() {
    if (!shop || !newBarber.trim()) return;
    await supabase.from("barbers").insert({ shop_id: shop.id, name: newBarber.trim() });
    setNewBarber(""); reload();
  }
  async function delBarber(id: string) { await supabase.from("barbers").delete().eq("id", id); reload(); }

  async function addSvc() {
    if (!shop || !newSvc.name) return;
    await supabase.from("services").insert({
      shop_id: shop.id,
      barber_id: newSvc.barber_id || null,
      name: newSvc.name, price: newSvc.price, duration_minutes: newSvc.duration_minutes,
    });
    setNewSvc({ name: "", price: 0, duration_minutes: 30, barber_id: "" });
    reload();
  }
  async function delSvc(id: string) { await supabase.from("services").delete().eq("id", id); reload(); }

  if (!shop) {
    return (
      <div className="min-h-screen bg-background">
        <BarberHeader sub="Configurer la boutique" />
        <div className="p-5 max-w-md mx-auto">
          <form onSubmit={createShop} className="bg-card border rounded-2xl p-5 space-y-3">
            <h2 className="font-semibold">Créer ta boutique</h2>
            <input required placeholder="Nom de la boutique" value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-background border rounded-2xl px-4 py-3 outline-none" />
            <button className="w-full bg-primary text-primary-foreground py-3 rounded-2xl font-medium">Créer</button>
          </form>
        </div>
      </div>
    );
  }

  const shopUrl = typeof window !== "undefined" ? `${window.location.origin}/shop/${shop.id}` : "";
  const hiddenQrRef = useRef<HTMLDivElement | null>(null);

  function getQrDataUrl(): string | null {
    const canvas = hiddenQrRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    return canvas ? canvas.toDataURL("image/png") : null;
  }

  function downloadPng() {
    const url = getQrDataUrl();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${shop?.name || "barber"}-qr.png`;
    a.click();
  }

  function downloadPdf() {
    const url = getQrDataUrl();
    if (!url || !shop) return;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.text("Barber_Pro", pageW / 2, 25, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(18);
    doc.text(shop.name, pageW / 2, 40, { align: "center" });

    const qrSize = 120;
    doc.addImage(url, "PNG", (pageW - qrSize) / 2, 60, qrSize, qrSize);

    doc.setFontSize(14);
    doc.text("Scannez pour rejoindre la file d'attente", pageW / 2, 200, { align: "center" });

    if (shop.address) {
      doc.setFontSize(11);
      doc.text(shop.address, pageW / 2, pageH - 20, { align: "center" });
    }

    doc.save(`${shop.name}-qr.pdf`);
  }

  return (
    <div className="min-h-screen bg-background">
      <BarberHeader sub="Boutique" />
      <BarberTabs />

      <div className="p-5 space-y-4 max-w-md mx-auto pb-16">
        {/* QR */}
        <div className="bg-card border rounded-2xl p-5 text-center">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">QR code client</div>
          <div className="bg-white p-4 rounded-2xl inline-block">
            <QRCodeSVG value={shopUrl} size={160} level="H" />
          </div>
          <div className="text-xs text-muted-foreground mt-3 break-all">{shopUrl}</div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button onClick={downloadPng}
              className="flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-2xl text-sm font-medium">
              <Download size={14} /> PNG
            </button>
            <button onClick={downloadPdf}
              className="flex items-center justify-center gap-2 bg-background border py-2.5 rounded-2xl text-sm font-medium">
              <FileText size={14} /> PDF
            </button>
          </div>
          {/* Hidden high-res canvas for export */}
          <div ref={hiddenQrRef} style={{ position: "absolute", left: -99999, top: -99999 }}>
            <QRCodeCanvas value={shopUrl} size={1000} level="H" includeMargin />
          </div>
        </div>


        {/* Shop info */}
        <div className="bg-card border rounded-2xl p-5 space-y-3">
          <h3 className="font-medium">Informations</h3>
          <input value={shop.name} onChange={e => setShop({ ...shop, name: e.target.value })}
            onBlur={e => updateShop({ name: e.target.value })}
            className="w-full bg-background border rounded-2xl px-4 py-2.5" placeholder="Nom" />
          <textarea value={shop.description ?? ""} onChange={e => setShop({ ...shop, description: e.target.value })}
            onBlur={e => updateShop({ description: e.target.value })}
            className="w-full bg-background border rounded-2xl px-4 py-2.5" placeholder="Description" rows={2} />
          <input value={shop.address ?? ""} onChange={e => setShop({ ...shop, address: e.target.value })}
            onBlur={e => updateShop({ address: e.target.value })}
            className="w-full bg-background border rounded-2xl px-4 py-2.5" placeholder="Adresse" />
          <input value={shop.phone ?? ""} onChange={e => setShop({ ...shop, phone: e.target.value })}
            onBlur={e => updateShop({ phone: e.target.value })}
            className="w-full bg-background border rounded-2xl px-4 py-2.5" placeholder="Téléphone" />
          <input value={shop.opening_hours ?? ""} onChange={e => setShop({ ...shop, opening_hours: e.target.value })}
            onBlur={e => updateShop({ opening_hours: e.target.value })}
            className="w-full bg-background border rounded-2xl px-4 py-2.5" placeholder="Horaires" />
          <label className="flex items-center justify-between text-sm">
            <span>Boutique ouverte</span>
            <input type="checkbox" checked={shop.is_open}
              onChange={e => { setShop({ ...shop, is_open: e.target.checked }); updateShop({ is_open: e.target.checked }); }} />
          </label>
        </div>

        {/* Barbers */}
        <div className="bg-card border rounded-2xl p-5">
          <h3 className="font-medium mb-3">Barbiers</h3>
          <div className="space-y-2 mb-3">
            {barbers.map(b => (
              <div key={b.id} className="flex items-center justify-between bg-background border rounded-2xl px-4 py-2.5">
                <span className="text-sm">{b.name}</span>
                <button onClick={() => delBarber(b.id)} className="text-destructive"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newBarber} onChange={e => setNewBarber(e.target.value)}
              placeholder="Nom du barbier" className="flex-1 bg-background border rounded-2xl px-4 py-2.5" />
            <button onClick={addBarber} className="bg-primary text-primary-foreground rounded-2xl px-4">
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Services */}
        <div className="bg-card border rounded-2xl p-5">
          <h3 className="font-medium mb-3">Services</h3>
          <div className="space-y-2 mb-3">
            {services.map(s => (
              <div key={s.id} className="flex items-center justify-between bg-background border rounded-2xl px-4 py-2.5">
                <div className="text-sm">
                  <div>{s.name}</div>
                  <div className="text-xs text-muted-foreground">{formatFCFA(s.price)} · {s.duration_minutes} min</div>
                </div>
                <button onClick={() => delSvc(s.id)} className="text-destructive"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <input value={newSvc.name} onChange={e => setNewSvc({ ...newSvc, name: e.target.value })}
              placeholder="Nom du service" className="w-full bg-background border rounded-2xl px-4 py-2.5" />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min={0} value={newSvc.price}
                onChange={e => setNewSvc({ ...newSvc, price: parseInt(e.target.value || "0") })}
                placeholder="Prix" className="bg-background border rounded-2xl px-4 py-2.5" />
              <input type="number" min={5} value={newSvc.duration_minutes}
                onChange={e => setNewSvc({ ...newSvc, duration_minutes: parseInt(e.target.value || "30") })}
                placeholder="Durée (min)" className="bg-background border rounded-2xl px-4 py-2.5" />
            </div>
            <select value={newSvc.barber_id} onChange={e => setNewSvc({ ...newSvc, barber_id: e.target.value })}
              className="w-full bg-background border rounded-2xl px-4 py-2.5">
              <option value="">Tous les barbiers</option>
              {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <button onClick={addSvc} className="w-full bg-primary text-primary-foreground py-2.5 rounded-2xl flex items-center justify-center gap-1">
              <Plus size={16} /> Ajouter le service
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
