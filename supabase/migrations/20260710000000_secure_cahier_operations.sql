-- Migration: Sécurisation de la table cahier_operations avec RLS (Row Level Security)

-- 1. Création de la table si elle n'existe pas déjà (structure basée sur le modèle)
CREATE TABLE IF NOT EXISTS public.cahier_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site TEXT NOT NULL,
    type TEXT NOT NULL,
    date DATE NOT NULL,
    heure TIME NOT NULL,
    quantite NUMERIC,
    produit TEXT,
    destination TEXT,
    details TEXT,
    sonLevel TEXT,
    frequence TEXT,
    collaborateur TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    isDraft BOOLEAN DEFAULT false,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Activation du RLS sur la table
ALTER TABLE public.cahier_operations ENABLE ROW LEVEL SECURITY;

-- 3. Suppression des anciennes politiques si elles existent pour éviter les conflits
DROP POLICY IF EXISTS "Les utilisateurs peuvent voir toutes les opérations de leur site" ON public.cahier_operations;
DROP POLICY IF EXISTS "Les utilisateurs authentifiés peuvent voir toutes les opérations" ON public.cahier_operations;
DROP POLICY IF EXISTS "Les utilisateurs peuvent créer leurs propres opérations" ON public.cahier_operations;
DROP POLICY IF EXISTS "Les utilisateurs peuvent modifier leurs propres opérations" ON public.cahier_operations;
DROP POLICY IF EXISTS "Les utilisateurs peuvent supprimer leurs propres opérations" ON public.cahier_operations;

-- 4. Création des politiques de sécurité (Policies)

-- Lecture : Tous les utilisateurs authentifiés ne peuvent voir que leurs propres opérations
CREATE POLICY "Les utilisateurs authentifiés peuvent voir leurs propres opérations" 
ON public.cahier_operations 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Insertion : Un utilisateur ne peut insérer une opération qu'en son propre nom (user_id correspond à son ID Supabase)
CREATE POLICY "Les utilisateurs peuvent créer leurs propres opérations" 
ON public.cahier_operations 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Mise à jour : Un utilisateur ne peut modifier que les opérations qu'il a créées
CREATE POLICY "Les utilisateurs peuvent modifier leurs propres opérations" 
ON public.cahier_operations 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Suppression : Un utilisateur ne peut supprimer que les opérations qu'il a créées
CREATE POLICY "Les utilisateurs peuvent supprimer leurs propres opérations" 
ON public.cahier_operations 
FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);
