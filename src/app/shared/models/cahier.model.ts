export interface ChargementItem {
  date: string;       // Date au format YYYY-MM-DD
  dn: string;         // Document Note / Bon de livraison
  produit: string;    // Nom du produit
  qte: number;        // Quantité
  pu: number;         // Prix unitaire
  montant: number;    // Montant total de la ligne
}

export interface Operation {
  id: string;
  site: string; // e.g., 'Douala', 'Yaoundé', 'Kribi', 'AFISA'
  type: 'Chargement' | 'Déchargement' | 'Surmontage' | 'Transfert' | 'Son' | 'Chargement des wagons';
  date: string; // 'YYYY-MM-DD'
  heure: string; // 'HH:MM'
  quantite?: number; // For Déchargement, Surmontage, Transfert
  produit?: string; // e.g., 'Ciment', 'Farine', 'Gazole'
  destination?: string; // For Transfert
  details?: string;
  sonLevel?: string; // For Son (e.g., 'Faible', 'Moyen', 'Élevé')
  frequence?: string; // For Son (e.g., 'Basse', 'Haute')
  collaborateur?: string;
  items?: ChargementItem[]; // Table de lignes pour les opérations de type Chargement
  isDraft?: boolean; // Indique si l'opération est un brouillon
  user_id?: string; // ID de l'utilisateur Supabase pour l'application des politiques RLS
}

export interface MonthlySummary {
  month: string; // e.g., 'Juillet 2026'
  site: string;
  type: string;
  count: number;
  operations: Operation[];
}
