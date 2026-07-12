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

  // Signal pour tracker si on est en train de charger
  private readonly _isLoading = signal(false);
  readonly isLoading = computed(() => this._isLoading());

  // Signal pour les erreurs
  private readonly _lastError = signal<string | null>(null);
  readonly lastError = computed(() => this._lastError());

  constructor() {
    // Re-load operations whenever the authenticated user changes
    effect(() => {
      const user = this.authService.currentUser();
      this.loadInitialOperations(user?.id);
    });
  }

  /**
   * Loads initial operations from local storage and tries to fetch from Supabase if table is ready
   * 
   * ✅ CORRIGÉ:
   * - Utilise 'cahier_operations' au lieu de 'operations'
   * - Ajoute le filtre user_id
   * - Utilise la structure JSONB 'items' au lieu de 'operation_items'
   */
  async loadInitialOperations(userId?: string) {
    if (!userId) {
      this._operations.set([]);
      this._lastError.set(null);
      return;
    }

    this._isLoading.set(true);
    this._lastError.set(null);

    try {
      // 1. Load from localStorage as a fast local fallback (User-specific)
      const localData = localStorage.getItem(`portsync_operations_${userId}`);
      if (localData) {
        try {
          this._operations.set(JSON.parse(localData));
          console.log('✅ Données chargées du localStorage');
        } catch (e) {
          console.error('❌ Erreur parsing localStorage', e);
        }
      } else {
        // Initialiser avec un tableau vide
        this._operations.set([]);
      }

      // 2. Try to sync with Supabase if the table exists
      try {
        // ✅ CORRECTION #1: Utiliser 'cahier_operations' au lieu de 'operations'
        // ✅ CORRECTION #2: Ajouter le filtre .eq('user_id', userId)
        const { data, error } = await this.supabaseService.client
          .from('cahier_operations')  // ✅ CORRECT
          .select('*')
          .eq('user_id', userId)  // ✅ FILTRE USER_ID
          .order('date', { ascending: false });

        if (!error && data) {
          console.log('✅ Données reçues de Supabase:', data.length, 'opérations');
          const mappedOps = this.mapOperationsFromDB(data as Record<string, unknown>[]);
          this._operations.set(mappedOps);
          this.saveToLocal(mappedOps);
        } else if (error) {
          console.warn('⚠️  Erreur fetch Supabase:', error.message);
          this._lastError.set(`Erreur Supabase: ${error.message}`);
          // Les données du localStorage restent chargées
        }
      } catch (err) {
        console.warn('⚠️  Erreur connexion Supabase:', err);
        this._lastError.set(`Erreur connexion: ${err instanceof Error ? err.message : 'Inconnue'}`);
        // Les données du localStorage restent chargées
      }
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * ✅ NOUVELLE MÉTHODE: Rechargement public des opérations (utilisé par Realtime)
   * 
   * Cette méthode est appelée automatiquement par CahierRealtimeSyncService
   * chaque fois qu'un changement est reçu via Realtime
   * 
   * @param userId - ID de l'utilisateur (optionnel, utilise l'utilisateur actuel par défaut)
   */
  async reloadOperations(userId?: string): Promise<void> {
    if (!userId) {
      userId = this.authService.currentUser()?.id;
    }

    if (!userId) {
      console.warn('⚠️  Impossible de recharger: pas d\'utilisateur');
      return;
    }

    this._isLoading.set(true);
    this._lastError.set(null);

    try {
      // ✅ CORRECTION #1: Utiliser 'cahier_operations'
      // ✅ CORRECTION #2: Ajouter le filtre .eq('user_id', userId)
      const { data, error } = await this.supabaseService.client
        .from('cahier_operations')  // ✅ CORRECT
        .select('*')
        .eq('user_id', userId)  // ✅ FILTRE USER_ID
        .order('date', { ascending: false });

      if (!error && data) {
        console.log('🔄 Opérations rechargées:', data.length, 'opérations');
        const mappedOps = this.mapOperationsFromDB(data as Record<string, unknown>[]);
        this._operations.set(mappedOps);
        this.saveToLocal(mappedOps);
      } else if (error) {
        console.error('❌ Erreur rechargement:', error.message);
        this._lastError.set(`Erreur rechargement: ${error.message}`);
      }
    } catch (err) {
      console.error('❌ Erreur rechargement:', err);
      this._lastError.set(`Erreur rechargement: ${err instanceof Error ? err.message : 'Inconnue'}`);
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * ✅ NOUVELLE MÉTHODE: Mapper les opérations depuis la base de données
   * Centralise la logique de mapping pour éviter la duplication
   * 
   * ✅ CORRECTION #3: Utiliser la colonne 'items' (JSONB) au lieu de 'operation_items'
   */
  private mapOperationsFromDB(dbOps: Record<string, unknown>[]): Operation[] {
    return dbOps.map(dbOp => {
      // Gérer les variantes de noms de colonnes pour isDraft
      const isDraftVal = dbOp['isdraft'] !== undefined 
        ? dbOp['isdraft'] 
        : (dbOp['isDraft'] !== undefined ? dbOp['isDraft'] : false);

      // Gérer les variantes de noms de colonnes pour sonLevel
      const sonLevelVal = dbOp['sonlevel'] !== undefined 
        ? dbOp['sonlevel'] 
        : (dbOp['sonLevel'] || 'Moyen');

      // ✅ CORRECTION #3: Utiliser 'items' (JSONB) au lieu de 'operation_items'
      const rawItems = dbOp['items'] || [];

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
        items: Array.isArray(rawItems) 
          ? (rawItems as Record<string, unknown>[]).map((item) => ({
              id: (item['id'] as string) || crypto.randomUUID(),
              date: (item['date'] as string) || (dbOp['date'] as string),
              dn: (item['dn'] as string) || '',
              produit: (item['produit'] as string) || '',
              qte: Number(item['qte']) || Number(item['quantite']) || 0,
              pu: Number(item['pu']) || 0,
              montant: Number(item['montant']) || 0
            }))
          : []
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
   * 
   * ✅ CORRIGÉ:
   * - Utilise 'cahier_operations'
   * - Ajoute user_id lors de l'upsert
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

    // Update local state optimistically
    const filtered = this._operations().filter(op => op.id !== id);
    const updated = [finalizedOp, ...filtered];
    this._operations.set(updated);
    this.saveToLocal(updated);

    // Try to upsert to Supabase
    try {
      // ✅ CORRECTION: Utiliser 'cahier_operations'
      const { error } = await this.supabaseService.client
        .from('cahier_operations')  // ✅ CORRECT
        .upsert([{
          id: finalizedOp.id,
          site: finalizedOp.site,
          type: finalizedOp.type,
          date: finalizedOp.date,
          heure: finalizedOp.heure,
          details: finalizedOp.details,
          sonlevel: finalizedOp.sonLevel,
          sonLevel: finalizedOp.sonLevel,
          frequence: finalizedOp.frequence,
          collaborateur: finalizedOp.collaborateur,
          isdraft: finalizedOp.isDraft,
          isDraft: finalizedOp.isDraft,
          user_id: finalizedOp.user_id,  // ✅ AJOUTER USER_ID
          items: finalizedOp.items || []
        }], { onConflict: 'id' });

      if (error) {
        console.warn('⚠️  Opération ajoutée localement mais erreur Supabase:', error.message);
      } else {
        console.log('✅ Opération sauvegardée à Supabase');
      }
    } catch (err) {
      console.warn('⚠️  Erreur save Supabase:', err);
      // L'opération reste en cache local, elle sera synchronisée plus tard
    }

    return finalizedOp;
  }

  /**
   * Saves or updates a draft operation
   * 
   * ✅ CORRIGÉ:
   * - Utilise 'cahier_operations'
   * - Ajoute user_id lors de l'upsert
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
      // ✅ CORRECTION: Utiliser 'cahier_operations'
      const { error } = await this.supabaseService.client
        .from('cahier_operations')  // ✅ CORRECT
        .upsert([{
          id: draftOp.id,
          site: draftOp.site,
          type: draftOp.type,
          date: draftOp.date,
          heure: draftOp.heure,
          details: draftOp.details,
          sonlevel: draftOp.sonLevel,
          sonLevel: draftOp.sonLevel,
          frequence: draftOp.frequence,
          collaborateur: draftOp.collaborateur,
          isdraft: draftOp.isDraft,
          isDraft: draftOp.isDraft,
          user_id: draftOp.user_id,  // ✅ AJOUTER USER_ID
          items: draftOp.items || []
        }], { onConflict: 'id' });

      if (error) {
        console.warn('⚠️  Brouillon sauvegardé localement mais erreur Supabase:', error.message);
      }
    } catch (err) {
      console.warn('⚠️  Erreur save draft Supabase:', err);
    }

    return draftOp;
  }

  /**
   * Deletes an operation
   * 
   * ✅ CORRIGÉ:
   * - Utilise 'cahier_operations'
   */
  async deleteOperation(id: string): Promise<boolean> {
    const updated = this._operations().filter(op => op.id !== id);
    this._operations.set(updated);
    this.saveToLocal(updated);

    try {
      // ✅ CORRECTION: Utiliser 'cahier_operations'
      const { error } = await this.supabaseService.client
        .from('cahier_operations')  // ✅ CORRECT
        .delete()
        .eq('id', id);

      if (error) {
        console.warn('⚠️  Suppression locale mais erreur Supabase:', error.message);
      } else {
        console.log('✅ Opération supprimée de Supabase');
      }
    } catch (err) {
      console.warn('⚠️  Erreur suppression Supabase:', err);
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
}
