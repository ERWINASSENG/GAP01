import { Injectable, inject, signal, computed, effect, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Operation, MonthlySummary, WorkWeek } from '../../shared/models/cahier.model';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class CahierService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  // Core state of operations and weeks using signals
  private readonly _operations = signal<Operation[]>([]);
  private readonly _adminOperations = signal<Operation[]>([]);
  private readonly _weeks = signal<WorkWeek[]>([]);

  // Public read-only signals
  readonly operations = computed(() => this._operations());
  readonly adminOperations = computed(() => this._adminOperations());
  readonly weeks = computed(() => this._weeks());

  constructor() {
    // Re-load operations and weeks whenever the authenticated user changes
    effect(() => {
      const user = this.authService.currentUser();
      this.loadInitialOperations(user?.id);
      this.loadInitialWeeks(user?.id);
      if (user?.role === 'admin') {
        this.loadAllOperationsForAdmin();
      }
    });
  }

  /**
   * Loads initial weeks from Supabase
   */
  private async loadInitialWeeks(userId?: string) {
    const user = this.authService.currentUser();
    if (!userId || !user?.assignedSiteName) {
      this._weeks.set([]);
      return;
    }

    try {
      const { data, error } = await this.supabaseService.client
        .from('cahier_weeks')
        .select('*')
        .eq('site', user.assignedSiteName)
        .order('start_date', { ascending: false });

      if (!error && data) {
        const mappedWeeks: WorkWeek[] = data.map((w: Record<string, unknown>) => ({
          id: w['id'] as string,
          site: w['site'] as string,
          start_date: w['start_date'] as string,
          end_date: w['end_date'] as string,
          is_closed: w['is_closed'] as boolean,
          closed_at: w['closed_at'] as string,
          created_at: w['created_at'] as string,
          user_id: w['user_id'] as string
        }));
        this._weeks.set(mappedWeeks);
      } else if (error) {
        console.error('❌ Erreur Supabase (Fetch semaines):', error.message);
      }
    } catch (err) {
      console.error('❌ Erreur Réseau ou Supabase (semaines):', err);
    }
  }

  /**
   * Gets the active (not closed) week for a specific site
   */
  getActiveWeek(site: string): WorkWeek | undefined {
    return this._weeks().find(w => w.site === site && !w.is_closed);
  }

  /**
   * Initializes a new work week of 6 days for a site starting at a specific date
   */
  async createWeek(site: string, startDateStr: string): Promise<WorkWeek> {
    const user = this.authService.currentUser();
    const id = crypto.randomUUID();

    // Calculate end_date = startDate + 5 days
    const startDate = new Date(startDateStr);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 5);
    const endDateStr = endDate.toISOString().split('T')[0];

    const newWeek: WorkWeek = {
      id,
      site,
      start_date: startDateStr,
      end_date: endDateStr,
      is_closed: false,
      user_id: user?.id,
      created_at: new Date().toISOString()
    };

    const previousWeeks = this._weeks();
    const updated = [newWeek, ...previousWeeks];
    this._weeks.set(updated);

    try {
      const { error } = await this.supabaseService.client
        .from('cahier_weeks')
        .insert([{
          id: newWeek.id,
          site: newWeek.site,
          start_date: newWeek.start_date,
          end_date: newWeek.end_date,
          is_closed: newWeek.is_closed,
          user_id: newWeek.user_id
        }]);
      if (error) throw error;
    } catch (err) {
      console.error('Error creating week in Supabase:', err);
      // Rollback
      this._weeks.set(previousWeeks);
      throw err;
    }

    return newWeek;
  }

  /**
   * Closes an active week manually
   */
  async closeWeek(weekId: string): Promise<boolean> {
    const weekToClose = this._weeks().find(w => w.id === weekId);
    if (!weekToClose) return false;

    const today = new Date().toISOString().split('T')[0];
    if (today < weekToClose.end_date) {
      console.warn(`Cannot close week before its end date (${weekToClose.end_date})`);
      return false;
    }

    const closedAt = new Date().toISOString();

    const previousWeeks = this._weeks();
    const updated = previousWeeks.map(w => {
      if (w.id === weekId) {
        return { ...w, is_closed: true, closed_at: closedAt };
      }
      return w;
    });

    this._weeks.set(updated);

    try {
      const { error } = await this.supabaseService.client
        .from('cahier_weeks')
        .update({ is_closed: true, closed_at: closedAt })
        .eq('id', weekId);

      if (error) throw error;
    } catch (err) {
      console.error('Error closing week:', err);
      // Rollback
      this._weeks.set(previousWeeks);
      return false;
    }

    return true;
  }

  /**
   * Validates if a date can be inserted for a specific site's week
   */
  validateOperationDate(site: string, dateStr: string): { allowed: boolean; reason?: string; activeWeek?: WorkWeek } {
    const active = this.getActiveWeek(site);
    if (!active) {
      // No active week, so we are allowed to insert (this operation will automatically create the week)
      return { allowed: true };
    }

    // Check if the date is strictly greater than start_date + 5 days (end_date)
    if (dateStr > active.end_date) {
      return {
        allowed: false,
        reason: `La date de l'opération (${dateStr}) dépasse la semaine de travail active de 6 jours du site ${site} (du ${active.start_date} au ${active.end_date}). Veuillez d'abord clôturer cette semaine.`,
        activeWeek: active
      };
    }

    return { allowed: true };
  }

  /**
   * Loads initial operations from Supabase if table is ready
   */
  private async loadInitialOperations(userId?: string) {
    const user = this.authService.currentUser();
    if (!userId || !user?.assignedSiteName) {
      this._operations.set([]);
      return;
    }

    try {
      const { data, error } = await this.supabaseService.client
        .from('operations')
        .select('*, operation_items(*)')
        .eq('site', user.assignedSiteName)
        .order('date', { ascending: false });

      if (!error && data) {
        const mappedOps = this.mapDatabaseOperations(data);
        this._operations.set(mappedOps);
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
    if (!this.isBrowser) return;

    const user = this.authService.currentUser();
    if (user?.role !== 'admin' || !user?.assignedSiteName) {
      this._adminOperations.set([]);
      return;
    }

    try {
      const session = await this.supabaseService.getSession();
      const token = session?.access_token;
      
      if (!token) {
        console.error('❌ Erreur: Session non valide pour admin fetch.');
        return;
      }

      const response = await fetch('/api/admin/operations', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();

      if (response.ok && data.success && data.operations) {
        const mappedOps = this.mapDatabaseOperations(data.operations);
        this._adminOperations.set(mappedOps);
      } else {
        console.error('❌ Erreur serveur (Admin Fetch):', data.error);
      }
    } catch (err) {
      console.error('❌ Erreur Réseau (Admin Fetch):', err);
    }
  }

  private mapDatabaseOperations(data: Record<string, unknown>[]): Operation[] {
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
        week_id: dbOp['week_id'] as string,
        items: Array.isArray(rawItems) ? (rawItems as Record<string, unknown>[]).map((item) => ({
          id: (item['id'] as string) || crypto.randomUUID(),
          date: (item['date'] as string) || (dbOp['date'] as string),
          dn: (item['dn'] as string) || '',
          produit: (item['produit'] as string) || '',
          qte: Number(item['quantite'] ?? item['qte']) || 0,
          pu: Number(item['pu']) || 0,
          montant: Number(item['montant']) || 0
        })) : []
      };
    });
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

    // 1. Validation of the date against work weeks
    const validation = this.validateOperationDate(opData.site, opData.date);
    if (!validation.allowed) {
      throw new Error(validation.reason);
    }

    // 2. Automatic weekly management : find or create active week
    let weekId = opData.week_id;
    if (!weekId) {
      let activeWeek = this.getActiveWeek(opData.site);
      if (!activeWeek) {
        activeWeek = await this.createWeek(opData.site, opData.date);
      }
      weekId = activeWeek.id;
    }
    
    const finalizedOp: Operation = {
      ...opData,
      id,
      week_id: weekId,
      collaborateur: user?.displayName || 'Collaborateur',
      user_id: user?.id,
      isDraft: false
    };

    const filtered = this._operations().filter(op => op.id !== id);
    const updated = [finalizedOp, ...filtered];
    this._operations.set(updated);

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
          user_id: finalizedOp.user_id,
          week_id: finalizedOp.week_id
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
            date: item.date,
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

    let weekId = opData.week_id;
    if (!weekId && opData.site) {
      const activeWeek = this.getActiveWeek(opData.site);
      if (activeWeek) {
        weekId = activeWeek.id;
      }
    }
    
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
      week_id: weekId,
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
          user_id: draftOp.user_id,
          week_id: draftOp.week_id
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
            date: item.date,
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
