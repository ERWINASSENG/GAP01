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
  private readonly _adminOperations = signal<Operation[]>([]);

  // Public read-only signal for operations
  readonly operations = computed(() => this._operations());
  readonly adminOperations = computed(() => this._adminOperations());

  /**
   * Checks if the user is a mock/demo user (local mode only)
   */
  private isMockUser(userId?: string): boolean {
    const id = userId || this.authService.currentUser()?.id;
    return !!id && id.startsWith('usr');
  }

  constructor() {
    // Re-load operations whenever the authenticated user changes
    effect(() => {
      const user = this.authService.currentUser();
      this.loadInitialOperations(user?.id);
      if (user?.role === 'admin') {
        this.loadAllOperationsForAdmin();
      }
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
    }

    // 2. Try to sync with Supabase if the table exists
    if (this.isMockUser(userId)) {
      console.log('ℹ️ User is a mock/demo user. Skipping Supabase sync and relying purely on localStorage.');
      return;
    }

    try {
      const { data, error } = await this.supabaseService.client
        .from('operations')
        .select('*, operation_items(*)')
        .order('date', { ascending: false });

      if (!error && data) {
        const mappedOps = this.mapDatabaseOperations(data);
        this._operations.set(mappedOps);
        this.saveToLocal(mappedOps);
      } else if (error) {
        console.error('❌ Erreur Supabase (Fetch opérations):', error.message);
      }
    } catch (err) {
      console.error('❌ Erreur Réseau ou Supabase:', err);
    }
  }

  /**
   * Loads all operations from all users (Admin only)
   */
  async loadAllOperationsForAdmin() {
    if (this.authService.currentUser()?.role !== 'admin') return;

    try {
      const { data, error } = await this.supabaseService.client
        .from('operations')
        .select('*, operation_items(*)')
        .order('date', { ascending: false });

      if (!error && data) {
        const mappedOps = this.mapDatabaseOperations(data);
        this._adminOperations.set(mappedOps);
      } else if (error) {
        console.error('❌ Erreur Supabase (Admin Fetch):', error.message);
      }
    } catch (err) {
      console.error('❌ Erreur Réseau (Admin Fetch):', err);
    }
  }

  private mapDatabaseOperations(data: any[]): Operation[] {
    return data.map(dbOp => {
      const isDraftVal = dbOp['isdraft'] !== undefined ? dbOp['isdraft'] : (dbOp['isDraft'] !== undefined ? dbOp['isDraft'] : false);
      const sonLevelVal = dbOp['sonlevel'] !== undefined ? dbOp['sonlevel'] : (dbOp['sonLevel'] || 'Moyen');
      const rawItems = dbOp['operation_items'] || [];
      return {
        id: dbOp['id'] as string,
        site: dbOp['site'] as string,
        type: dbOp['type'] as Operation['type'],
        date: dbOp['date'] as string,
        heure: dbOp['heure'] ? (dbOp['heure'] as string).slice(0, 5) : '',
        details: (dbOp['details'] as string) || '',
        sonLevel: sonLevelVal as string,
        frequence: (dbOp['frequence'] as string) || 'Basse',
        collaborateur: (dbOp['collaborateur'] as string) || 'Collaborateur',
        isDraft: isDraftVal as boolean,
        user_id: dbOp['user_id'] as string,
        items: Array.isArray(rawItems) ? rawItems.map((item: any) => ({
          id: item['id'] || crypto.randomUUID(),
          date: item['date'] || dbOp['date'],
          dn: item['dn'] || '',
          produit: item['produit'] || '',
          qte: Number(item['quantite']) || Number(item['qte']) || 0,
          pu: Number(item['pu']) || 0,
          montant: Number(item['montant']) || 0
        })) : []
      };
    });
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

    const filtered = this._operations().filter(op => op.id !== id);
    const updated = [finalizedOp, ...filtered];
    this._operations.set(updated);
    this.saveToLocal(updated);

    if (this.isMockUser(user?.id)) return finalizedOp;

    try {
      const { data: opData, error: opError } = await this.supabaseService.client
        .from('operations')
        .upsert([{
          id: finalizedOp.id,
          site: finalizedOp.site,
          type: finalizedOp.type,
          date: finalizedOp.date,
          heure: finalizedOp.heure,
          details: finalizedOp.details,
          sonlevel: finalizedOp.sonLevel,
          frequence: finalizedOp.frequence,
          collaborateur: finalizedOp.collaborateur,
          isdraft: finalizedOp.isDraft,
          user_id: finalizedOp.user_id
        }])
        .select()
        .single();

      if (!opError && opData) {
        await this.supabaseService.client
          .from('operation_items')
          .delete()
          .eq('operation_id', finalizedOp.id);

        if (finalizedOp.items && finalizedOp.items.length > 0) {
          const dbItems = finalizedOp.items.map(item => ({
            id: item.id || crypto.randomUUID(),
            operation_id: finalizedOp.id,
            dn: item.dn || '',
            produit: item.produit || '',
            quantite: Number(item.qte) || 0,
            pu: Number(item.pu) || 0,
            montant: Number(item.montant) || 0
          }));
          await this.supabaseService.client
            .from('operation_items')
            .insert(dbItems);
        }
      }
    } catch (err) {
      console.error('Error saving operation:', err);
    }

    return finalizedOp;
  }

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

    if (this.isMockUser(user?.id)) return draftOp;

    try {
      const { data: opData, error: opError } = await this.supabaseService.client
        .from('operations')
        .upsert([{
          id: draftOp.id,
          site: draftOp.site,
          type: draftOp.type,
          date: draftOp.date,
          heure: draftOp.heure,
          details: draftOp.details,
          sonlevel: draftOp.sonLevel,
          frequence: draftOp.frequence,
          collaborateur: draftOp.collaborateur,
          isdraft: draftOp.isDraft,
          user_id: draftOp.user_id
        }])
        .select()
        .single();

      if (!opError && opData) {
        await this.supabaseService.client
          .from('operation_items')
          .delete()
          .eq('operation_id', draftOp.id);

        if (draftOp.items && draftOp.items.length > 0) {
          const dbItems = draftOp.items.map(item => ({
            id: item.id || crypto.randomUUID(),
            operation_id: draftOp.id,
            dn: item.dn || '',
            produit: item.produit || '',
            quantite: Number(item.qte) || 0,
            pu: Number(item.pu) || 0,
            montant: Number(item.montant) || 0
          }));
          await this.supabaseService.client
            .from('operation_items')
            .insert(dbItems);
        }
      }
    } catch (err) {
      console.error('Error saving draft:', err);
    }

    return draftOp;
  }

  async deleteOperation(id: string): Promise<boolean> {
    const updated = this._operations().filter(op => op.id !== id);
    this._operations.set(updated);
    this.saveToLocal(updated);

    if (this.isMockUser()) return true;

    try {
      await this.supabaseService.client
        .from('operation_items')
        .delete()
        .eq('operation_id', id);

      await this.supabaseService.client
        .from('operations')
        .delete()
        .eq('id', id);
    } catch (err) {
      console.error('Error deleting operation:', err);
    }

    return true;
  }

  readonly monthlySummaries = computed<MonthlySummary[]>(() => {
    const ops = this._operations();
    return this.calculateSummaries(ops);
  });

  readonly adminMonthlySummaries = computed<MonthlySummary[]>(() => {
    const ops = this._adminOperations();
    return this.calculateSummaries(ops);
  });

  private calculateSummaries(ops: Operation[]): MonthlySummary[] {
    const groups: Record<string, Operation[]> = {};

    ops.forEach(op => {
      if (op.isDraft) return;
      if (!op || !op.date || typeof op.date !== 'string') return;
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
      const groupKey = `${monthYearKey}_${op.site}`;

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(op);
    });

    return Object.keys(groups).map(key => {
      const [month, site] = key.split('_');
      const operations = groups[key];
      return {
        month,
        site,
        type: '',
        count: operations.length,
        operations
      };
    });
  }
}
