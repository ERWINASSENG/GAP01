export type OperationStatus = 'planifie' | 'en_cours' | 'termine' | 'annule';
export type OperationType = 'chargement' | 'dechargement' | 'reconditionnement';

export interface PortOperation {
  id: string;
  vesselName: string;
  voyageNumber: string;
  type: OperationType | string;
  berthNumber: string;
  targetQuantity: number;
  completedQuantity: number;
  status: OperationStatus | string;
  scheduledDate?: string;
  completedDate?: string;
  details?: string;
}

export interface Agent {
  id: string;
  name: string;
  role: 'superviseur' | 'grutier' | 'docker' | 'pilote' | string;
  status: 'en_mission' | 'disponible' | 'indisponible' | string;
  currentOperationId?: string;
}

export interface Invoice {
  id: string;
  operationId: string;
  invoiceNumber: string;
  totalAmount: number;
  status: 'paye' | 'en_attente' | 'annule' | string;
  issueDate: string;
}
