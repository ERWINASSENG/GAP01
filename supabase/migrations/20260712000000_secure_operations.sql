-- 1. Activation du RLS sur les tables
ALTER TABLE public.operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_items ENABLE ROW LEVEL SECURITY;

-- 2. Création des politiques pour la table `operations`
CREATE POLICY "Les utilisateurs peuvent voir leurs propres opérations" 
ON public.operations FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Les utilisateurs peuvent créer leurs propres opérations" 
ON public.operations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Les utilisateurs peuvent modifier leurs propres opérations" 
ON public.operations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Les utilisateurs peuvent supprimer leurs propres opérations" 
ON public.operations FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3. Création des politiques pour la table `operation_items`
-- (Un item appartient à une opération qui appartient à l'utilisateur)
CREATE POLICY "Voir les items de ses opérations" 
ON public.operation_items FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM public.operations WHERE id = operation_items.operation_id AND user_id = auth.uid()));

CREATE POLICY "Créer des items pour ses opérations" 
ON public.operation_items FOR INSERT TO authenticated 
WITH CHECK (EXISTS (SELECT 1 FROM public.operations WHERE id = operation_items.operation_id AND user_id = auth.uid()));

CREATE POLICY "Modifier les items de ses opérations" 
ON public.operation_items FOR UPDATE TO authenticated 
USING (EXISTS (SELECT 1 FROM public.operations WHERE id = operation_items.operation_id AND user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.operations WHERE id = operation_items.operation_id AND user_id = auth.uid()));

CREATE POLICY "Supprimer les items de ses opérations" 
ON public.operation_items FOR DELETE TO authenticated 
USING (EXISTS (SELECT 1 FROM public.operations WHERE id = operation_items.operation_id AND user_id = auth.uid()));
