import { supabase } from "@/integrations/supabase/client";

export type QueueStatus = "waiting" | "in_progress" | "done" | "skipped" | "cancelled";

export async function joinQueue(opts: {
  shop_id: string;
  barber_id: string;
  service_id: string | null;
  client_name: string;
  client_phone?: string | null;
}) {
  // Compute next position
  const { count } = await supabase
    .from("queue_entries")
    .select("*", { count: "exact", head: true })
    .eq("barber_id", opts.barber_id)
    .in("status", ["waiting", "in_progress"]);

  const position = (count ?? 0) + 1;

  const { data, error } = await supabase
    .from("queue_entries")
    .insert({
      shop_id: opts.shop_id,
      barber_id: opts.barber_id,
      service_id: opts.service_id,
      client_name: opts.client_name,
      client_phone: opts.client_phone ?? null,
      status: "waiting",
      position,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function advanceQueue(barber_id: string) {
  // promote next waiting to in_progress
  const { data: next } = await supabase
    .from("queue_entries")
    .select("id")
    .eq("barber_id", barber_id)
    .eq("status", "waiting")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (next) {
    await supabase
      .from("queue_entries")
      .update({ status: "in_progress", called_at: new Date().toISOString() })
      .eq("id", next.id);
  }
}

export async function finishCurrent(entry: {
  id: string;
  shop_id: string;
  barber_id: string;
  client_name: string;
  service_id: string | null;
}) {
  // Get service info
  let serviceName = "Service";
  let amount = 0;
  if (entry.service_id) {
    const { data: svc } = await supabase
      .from("services")
      .select("name,price")
      .eq("id", entry.service_id)
      .maybeSingle();
    if (svc) {
      serviceName = svc.name;
      amount = svc.price;
    }
  }

  await supabase
    .from("queue_entries")
    .update({ status: "done", done_at: new Date().toISOString() })
    .eq("id", entry.id);

  await supabase.from("payments").insert({
    shop_id: entry.shop_id,
    barber_id: entry.barber_id,
    queue_entry_id: entry.id,
    client_name: entry.client_name,
    service_name: serviceName,
    amount,
  });

  await advanceQueue(entry.barber_id);
}

export async function skipCurrent(entry: { id: string; barber_id: string }) {
  await supabase.from("queue_entries").update({ status: "skipped" }).eq("id", entry.id);
  await advanceQueue(entry.barber_id);
}

export async function cancelCurrent(entry: { id: string; barber_id: string }) {
  await supabase.from("queue_entries").update({ status: "cancelled" }).eq("id", entry.id);
  await advanceQueue(entry.barber_id);
}

export function formatFCFA(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
}
