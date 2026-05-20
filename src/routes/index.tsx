import { createFileRoute, Link } from "@tanstack/react-router";
import { QrCode, ListChecks, MapPin } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Barber_Pro — Fini l'attente debout" },
      { name: "description", content: "Rejoins la file d'attente de ton barbier à distance, en scannant un QR code." },
    ],
  }),
  component: Landing,
});

function Step({ icon, n, title, desc }: { icon: React.ReactNode; n: number; title: string; desc: string }) {
  return (
    <div className="bg-card rounded-2xl border p-5 flex gap-4 items-start">
      <div className="w-11 h-11 rounded-2xl bg-primary text-primary-foreground grid place-items-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Étape {n}</div>
        <div className="font-medium">{title}</div>
        <div className="text-sm text-muted-foreground mt-1">{desc}</div>
      </div>
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between">
        <div className="font-semibold tracking-tight">Barber_Pro</div>
        <Link to="/barber/login" className="text-sm text-muted-foreground hover:text-foreground">
          Espace pro
        </Link>
      </header>

      <main className="flex-1 px-6 max-w-md w-full mx-auto">
        <section className="pt-10 pb-12 text-center">
          <h1 className="text-4xl font-semibold tracking-tight leading-tight">
            Fini l'attente<br />debout.
          </h1>
          <p className="mt-4 text-muted-foreground">
            Scanne le QR code de ton barbier, choisis ton service et suis ta position en temps réel.
          </p>
        </section>

        <section className="space-y-3 pb-12">
          <Step n={1} icon={<QrCode size={20} />} title="Scanne" desc="Le QR code affiché chez ton barbier." />
          <Step n={2} icon={<ListChecks size={20} />} title="Choisis" desc="Ton barbier et ton service." />
          <Step n={3} icon={<MapPin size={20} />} title="Suis ta position" desc="Reviens pile au bon moment." />
        </section>

        <Link
          to="/barber/login"
          className="block w-full text-center bg-primary text-primary-foreground py-4 rounded-2xl font-medium"
        >
          Espace pro
        </Link>
      </main>

      <footer className="px-6 py-8 text-center text-xs text-muted-foreground">
        © Barber_Pro
      </footer>
    </div>
  );
}
