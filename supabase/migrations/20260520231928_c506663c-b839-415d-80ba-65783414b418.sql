
-- shops
CREATE TABLE public.shops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  phone TEXT,
  opening_hours TEXT,
  is_open BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.barbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  specialties TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  barber_id UUID REFERENCES public.barbers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.queue_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT,
  status TEXT NOT NULL DEFAULT 'waiting',
  position INTEGER NOT NULL DEFAULT 0,
  called_at TIMESTAMPTZ,
  done_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  queue_entry_id UUID REFERENCES public.queue_entries(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  service_name TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- shops policies
CREATE POLICY "shops_public_read" ON public.shops FOR SELECT USING (true);
CREATE POLICY "shops_owner_insert" ON public.shops FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "shops_owner_update" ON public.shops FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "shops_owner_delete" ON public.shops FOR DELETE USING (auth.uid() = owner_id);

-- barbers policies
CREATE POLICY "barbers_public_read" ON public.barbers FOR SELECT USING (true);
CREATE POLICY "barbers_owner_all" ON public.barbers FOR ALL
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = barbers.shop_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = barbers.shop_id AND s.owner_id = auth.uid()));

-- services policies
CREATE POLICY "services_public_read" ON public.services FOR SELECT USING (true);
CREATE POLICY "services_owner_all" ON public.services FOR ALL
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = services.shop_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = services.shop_id AND s.owner_id = auth.uid()));

-- queue_entries policies
CREATE POLICY "queue_public_read" ON public.queue_entries FOR SELECT USING (true);
CREATE POLICY "queue_public_insert" ON public.queue_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "queue_owner_update" ON public.queue_entries FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = queue_entries.shop_id AND s.owner_id = auth.uid()));
CREATE POLICY "queue_owner_delete" ON public.queue_entries FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = queue_entries.shop_id AND s.owner_id = auth.uid()));

-- payments policies
CREATE POLICY "payments_public_read" ON public.payments FOR SELECT USING (true);
CREATE POLICY "payments_owner_all" ON public.payments FOR ALL
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = payments.shop_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = payments.shop_id AND s.owner_id = auth.uid()));

-- Realtime
ALTER TABLE public.queue_entries REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_entries;
