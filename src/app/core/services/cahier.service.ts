import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { Operation, MonthlySummary } from '../../shared/models/cahier.model';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class CahierService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);

  // Core state of operations using signals
  private readonly _operations = signal<Operation[]>([]);

  // Public read-only signal for operations
  readonly operations = computed(() => this._operations());

  constructor() {
    // Re-load operations whenever the authenticated user changes
    effect(() => {
      const user = this.authService.currentUser();
      this.loadInitialOperations(user?.id);
    });
  }

  /**
   * Loads initial operations from local storage and tries to fetch from Supabase if table is ready
   */
  private async loadInitialOperations(userId?: string) {
    if (!userId) {
      this._operations.set([]);
      return;
    }

    // 1. Load from localStorage as a fast local fallback (User-specific)
    const localData = localStorage.getItem(`portsync_operations_${userId}`);
    if (localData) {
      try {
        this._operations.set(JSON.parse(localData));
      } catch (e) {
        console.error('Error parsing local operations', e);
      }
    } else {
      // Seed some default data if empty so the user can see something immediately
      this.seedMockData(userId);
    }

    // 2. Try to sync with Supabase if the table exists
    try {
      const { data, error } = await this.supabaseService.client
        .from('cahier_operations')
        .select('*')
        .order('date', { ascending: false });

      if (!error && data) {
        this._operations.set(data);
        this.saveToLocal(data);
      }
    } catch {
      // Silently ignore or log if table is not provisioned yet, fallback is active
      console.log('Supabase cahier_operations table not configured. Using local state.');
    }
  }

  /**
   * Saves operations list to localStorage (User-specific)
   */
  private saveToLocal(operations: Operation[]) {
    const user = this.authService.currentUser();
    if (user?.id) {
      localStorage.setItem(`portsync_operations_${user.id}`, JSON.stringify(operations));
    }
  }

  /**
   * Public read-only signal for drafts
   */
  readonly drafts = computed(() => {
    return this._operations().filter(op => op.isDraft);
  });

  /**
   * Adds or finalizes an operation
   */
  async addOperation(opData: Omit<Operation, 'id' | 'collaborateur'> & { id?: string }): Promise<Operation> {
    const user = this.authService.currentUser();
    const id = opData.id || crypto.randomUUID();
    
    const finalizedOp: Operation = {
      ...opData,
      id,
      collaborateur: user?.displayName || 'Collaborateur',
      user_id: user?.id,
      isDraft: false
    };

    // Remove any existing draft with the same ID or replace it
    const filtered = this._operations().filter(op => op.id !== id);
    const updated = [finalizedOp, ...filtered];
    this._operations.set(updated);
    this.saveToLocal(updated);

    // Try to upsert to Supabase
    try {
      await this.supabaseService.client
        .from('cahier_operations')
        .upsert([finalizedOp]);
    } catch {
      // Fail silently, local storage is persistent enough
    }

    return finalizedOp;
  }

  /**
   * Saves or updates a draft operation
   */
  async saveDraft(opData: Partial<Operation>): Promise<Operation> {
    const user = this.authService.currentUser();
    const id = opData.id || crypto.randomUUID();
    const existing = this._operations().find(o => o.id === id);
    
    const draftOp: Operation = {
      site: opData.site || '',
      type: (opData.type || 'Chargement') as Operation['type'],
      date: opData.date || new Date().toISOString().split('T')[0],
      heure: opData.heure || new Date().toTimeString().slice(0, 5),
      details: opData.details || '',
      quantite: opData.quantite !== undefined ? opData.quantite : undefined,
      produit: opData.produit || '',
      destination: opData.destination || '',
      sonLevel: opData.sonLevel || 'Moyen',
      frequence: opData.frequence || 'Basse',
      items: opData.items || [],
      ...opData,
      id,
      collaborateur: user?.displayName || 'Collaborateur',
      user_id: user?.id,
      isDraft: true
    };

    let updated: Operation[];
    if (existing) {
      updated = this._operations().map(o => o.id === id ? draftOp : o);
    } else {
      updated = [draftOp, ...this._operations()];
    }

    this._operations.set(updated);
    this.saveToLocal(updated);

    // Try to upsert to Supabase
    try {
      await this.supabaseService.client
        .from('cahier_operations')
        .upsert([draftOp]);
    } catch {
      // Fail silently
    }

    return draftOp;
  }

  /**
   * Deletes an operation
   */
  async deleteOperation(id: string): Promise<boolean> {
    const updated = this._operations().filter(op => op.id !== id);
    this._operations.set(updated);
    this.saveToLocal(updated);

    try {
      await this.supabaseService.client
        .from('cahier_operations')
        .delete()
        .eq('id', id);
    } catch {
      // Ignored, handled locally
    }

    return true;
  }

  /**
   * Groups operations into Monthly summaries
   */
  readonly monthlySummaries = computed<MonthlySummary[]>(() => {
    const ops = this._operations();
    const groups: Record<string, Operation[]> = {};

    ops.forEach(op => {
      if (op.isDraft) return; // Do not include drafts in monthly summaries
      if (!op || !op.date || typeof op.date !== 'string') return;
      // Extract Month and Year (e.g. '2026-07' -> 'Juillet 2026')
      const dateParts = op.date.split('-');
      if (dateParts.length < 2) return;
      const year = dateParts[0];
      const monthNum = parseInt(dateParts[1], 10);
      
      const monthsFrench = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
      ];
      const monthFrench = monthsFrench[monthNum - 1] || 'Inconnu';
      const monthYearKey = `${monthFrench} ${year}`;
      const groupKey = `${monthYearKey}_${op.site}_${op.type}`;

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(op);
    });

    return Object.keys(groups).map(key => {
      const [month, site, type] = key.split('_');
      const operations = groups[key];
      return {
        month,
        site,
        type,
        count: operations.length,
        operations
      };
    });
  });

  /**
   * Seeds realistic initial operations
   */
  private seedMockData(userId?: string) {
    const initial: Operation[] = [
      {
        id: '1',
        site: 'Douala',
        type: 'Chargement',
        date: '2026-07-06', // Monday
        heure: '08:30',
        collaborateur: 'ERWIN ALBERIC ASSENG',
        user_id: userId,
        details: 'Chargement camion grue remorque 24T',
        items: [
          { date: '2026-07-06', dn: 'DN-2026-001', produit: 'Ciment CPJ45', qte: 12, pu: 4500, montant: 54000 },
          { date: '2026-07-06', dn: 'DN-2026-002', produit: 'Ciment Multix', qte: 20, pu: 4200, montant: 84000 }
        ]
      },
      {
        id: '2',
        site: 'Douala',
        type: 'Déchargement',
        date: '2026-07-06', // Monday
        heure: '10:15',
        collaborateur: 'ERWIN ALBERIC ASSENG',
        user_id: userId,
        details: 'Déchargement navire quai n°4',
        items: [
          { date: '2026-07-06', dn: 'DN-DEC-201', produit: 'Clinker', qte: 800, pu: 5000, montant: 4000000 }
        ]
      },
      {
        id: '3',
        site: 'Kribi',
        type: 'Transfert',
        date: '2026-07-07', // Tuesday
        heure: '14:00',
        collaborateur: 'Collaborateur',
        user_id: userId,
        details: 'Transfert inter-sites par camion benne',
        items: [
          { date: '2026-07-07', dn: 'DN-TRA-301', produit: 'Farine', qte: 500, pu: 4000, montant: 2000000 }
        ]
      },
      {
        id: '4',
        site: 'Douala',
        type: 'Surmontage',
        date: '2026-07-08', // Wednesday
        heure: '09:00',
        collaborateur: 'ERWIN ALBERIC ASSENG',
        user_id: userId,
        details: 'Réorganisation des stocks hangar A',
        items: [
          { date: '2026-07-08', dn: 'DN-SUR-401', produit: 'Gazole', qte: 1200, pu: 800, montant: 960000 }
        ]
      },
      {
        id: '5',
        site: 'AFISA',
        type: 'Son',
        date: '2026-07-09', // Thursday
        heure: '11:45',
        collaborateur: 'ERWIN ALBERIC ASSENG',
        user_id: userId,
        details: 'Contrôle de niveau sonore - Conforme',
        items: [
          { date: '2026-07-09', dn: 'DN-SON-501', produit: 'Contrôle Sonore', qte: 1, pu: 15000, montant: 15000 }
        ]
      },
      {
        id: '6',
        site: 'Yaoundé',
        type: 'Chargement',
        date: '2026-07-05', // Sunday
        heure: '16:30',
        collaborateur: 'Jean Dupont',
        user_id: userId,
        details: 'Livraison chantier périphérique',
        items: [
          { date: '2026-07-05', dn: 'DN-YAO-501', produit: 'Fer à béton 12mm', qte: 20, pu: 8500, montant: 170000 },
          { date: '2026-07-05', dn: 'DN-YAO-502', produit: 'Fer à béton 10mm', qte: 10, pu: 7500, montant: 75000 }
        ]
      }
    ];

    this._operations.set(initial);
    this.saveToLocal(initial);
  }
}
