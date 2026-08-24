ALTER TABLE public.baux 
  ADD COLUMN IF NOT EXISTS commission_agence numeric NOT NULL DEFAULT 0;

ALTER TABLE public.baux 
  ADD CONSTRAINT baux_commission_max_1_mois 
  CHECK (commission_agence >= 0 AND commission_agence <= loyer_mensuel);