
-- Modules de l'application
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  module text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role, module)
);

CREATE TABLE IF NOT EXISTS public.field_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  module text NOT NULL,
  field text NOT NULL,
  visible boolean NOT NULL DEFAULT true,
  editable boolean NOT NULL DEFAULT true,
  required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role, module, field)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read role_permissions" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage role_permissions" ON public.role_permissions FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE POLICY "Read field_permissions" ON public.field_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage field_permissions" ON public.field_permissions FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_role_permissions_updated BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_field_permissions_updated BEFORE UPDATE ON public.field_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed: admin = full access on all modules
WITH modules(m) AS (VALUES
  ('dashboard'),('caisse'),('recouvrement'),('suivi_locataires'),('juridique'),
  ('courriers_recus'),('reponses_courriers'),('courriers'),('reddition'),
  ('commercial'),('biens'),('proprietaires'),('locataires'),('baux'),
  ('modeles_relance'),('modeles_courrier'),('imports'),('exports'),('admin_users'),('admin_permissions')
)
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete)
SELECT 'admin'::app_role, m, true, true, true, true FROM modules
ON CONFLICT (role,module) DO NOTHING;

-- Direction: voit tout, gère beaucoup
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete) VALUES
('direction','dashboard',true,false,false,false),
('direction','caisse',true,true,true,false),
('direction','recouvrement',true,true,true,false),
('direction','suivi_locataires',true,true,true,false),
('direction','juridique',true,true,true,false),
('direction','courriers_recus',true,true,true,false),
('direction','reponses_courriers',true,true,true,false),
('direction','courriers',true,true,true,false),
('direction','reddition',true,true,true,true),
('direction','commercial',true,true,true,false),
('direction','biens',true,true,true,false),
('direction','proprietaires',true,true,true,true),
('direction','locataires',true,true,true,false),
('direction','baux',true,true,true,false),
('direction','modeles_relance',true,true,true,true),
('direction','modeles_courrier',true,true,true,true),
('direction','imports',true,true,false,false),
('direction','exports',true,false,false,false)
ON CONFLICT (role,module) DO NOTHING;

-- Commercial
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete) VALUES
('commercial','dashboard',true,false,false,false),
('commercial','commercial',true,true,true,false),
('commercial','biens',true,true,true,false),
('commercial','locataires',true,true,true,false),
('commercial','proprietaires',true,false,false,false),
('commercial','baux',true,false,false,false),
('commercial','exports',true,false,false,false)
ON CONFLICT (role,module) DO NOTHING;

-- Caisse
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete) VALUES
('caisse','dashboard',true,false,false,false),
('caisse','caisse',true,true,false,false),
('caisse','baux',true,true,true,false),
('caisse','locataires',true,true,true,false),
('caisse','biens',true,false,false,false),
('caisse','proprietaires',true,false,false,false),
('caisse','suivi_locataires',true,false,false,false),
('caisse','exports',true,false,false,false)
ON CONFLICT (role,module) DO NOTHING;

-- Recouvrement
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete) VALUES
('recouvrement','dashboard',true,false,false,false),
('recouvrement','recouvrement',true,true,true,false),
('recouvrement','suivi_locataires',true,true,true,false),
('recouvrement','locataires',true,false,true,false),
('recouvrement','baux',true,false,false,false),
('recouvrement','reponses_courriers',true,true,true,false),
('recouvrement','courriers_recus',true,true,true,false),
('recouvrement','exports',true,false,false,false)
ON CONFLICT (role,module) DO NOTHING;

-- Juridique
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete) VALUES
('juridique','dashboard',true,false,false,false),
('juridique','juridique',true,true,true,false),
('juridique','courriers',true,true,true,false),
('juridique','courriers_recus',true,true,true,false),
('juridique','reponses_courriers',true,true,true,false),
('juridique','modeles_courrier',true,true,true,false),
('juridique','locataires',true,false,false,false),
('juridique','baux',true,false,false,false),
('juridique','exports',true,false,false,false)
ON CONFLICT (role,module) DO NOTHING;
