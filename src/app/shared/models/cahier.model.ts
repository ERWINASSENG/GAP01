export interface OperationItem {
  id?: string;
  operation_id?: string;
  date: string;
  dn: string;
  produit: string;
  qte: number;
  pu: number;
  montant: number;
}

export interface WorkWeek {
  id: string;
  site: string;
  start_date: string; // ISO format (YYYY-MM-DD)
  end_date: string;   // start_date + 5 days
  is_closed: boolean;
  closed_at?: string;  // ISO timestamp
  created_at?: string;
  user_id?: string;
}

export interface Operation {
  id: string;
  site: string;
  type: 'Chargement' | 'Déchargement' | 'Surmontage' | 'Transfert' | 'Son' | 'Chargement des wagons' | 'Chargement wagons' | 'Chargement Wagon Blé' | 'Chargement Wagon Farine' | 'Reconditionnement' | 'Nettoyage' | 'Chargement Camions';
  date: string;
  heure: string;
  details?: string;
  sonLevel?: string;
  frequence?: string;
  collaborateur?: string;
  isDraft?: boolean;
  user_id?: string;
  week_id?: string; // Associated work week
  items?: OperationItem[];
  // Temporary fields to maintain compatibility while refactoring
  quantite?: number;
  produit?: string;
  destination?: string;
}

export interface MonthlySummary {
  month: string;
  site: string;
  type: string;
  count: number;
  operations: Operation[];
}
