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

export interface Operation {
  id: string;
  site: string;
  type: 'Chargement' | 'Déchargement' | 'Surmontage' | 'Transfert' | 'Son' | 'Chargement des wagons' | 'Chargement wagons' | 'Reconditionnement' | 'Nettoyage' | 'Chargement Camions';
  date: string;
  heure: string;
  details?: string;
  sonLevel?: string;
  frequence?: string;
  collaborateur?: string;
  isDraft?: boolean;
  user_id?: string;
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
