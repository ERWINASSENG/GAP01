import {Injectable, signal, computed, inject} from '@angular/core';
import {PortUser} from '../../shared/models/auth.model';
import {SupabaseService} from './supabase.service';
import {User} from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly supabaseService = inject(SupabaseService);

  // Signals for state management
  private currentUserSignal = signal<PortUser | null>(null);
  
  // Public exposure of signals
  readonly currentUser = computed(() => this.currentUserSignal());
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);
  readonly userRole = computed(() => this.currentUserSignal()?.role || null);

  private sessionInitPromise: Promise<void>;

  constructor() {
    this.sessionInitPromise = this.initSession();
    this.initSupabaseAuthListener();
  }

  /**
   * Attend que la session soit initialisée (utile pour les guards lors d'un rechargement de page)
   */
  async waitForSession(): Promise<void> {
    await this.sessionInitPromise;
  }

  /**
   * Initialize session from Supabase
   */
  private async initSession(): Promise<void> {
    const session = await this.supabaseService.getSession();
    if (session?.user) {
      this.setUserFromSession(session.user);
    }
  }

  /**
   * Initialise l'écouteur d'événements d'authentification Supabase
   */
  private initSupabaseAuthListener(): void {
    this.supabaseService.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        this.setUserFromSession(session.user);
      } else if (event === 'SIGNED_OUT') {
        this.currentUserSignal.set(null);
      }
    });
  }

  private setUserFromSession(user: User): void {
    const metadata = user.user_metadata || {};
    const portUser: PortUser = {
      id: user.id,
      email: user.email || '',
      username: user.email?.split('@')[0] || 'user',
      displayName: metadata['display_name'] || metadata['fullName'] || 'Collaborateur',
      role: metadata['role'] || 'user',
      avatarUrl: metadata['avatar_url'] || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      assignedSiteId: 'site-1',
      assignedSiteName: 'Terminal à Conteneurs A'
    };
    this.currentUserSignal.set(portUser);
  }

  /**
   * Connexion d'un utilisateur
   */
  async login(email: string, password?: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!password) {
        return { success: false, error: 'Mot de passe requis.' };
      }

      const { data, error } = await this.supabaseService.signIn(email, password);
      if (error) {
        return { success: false, error: error.message };
      }
      
      if (data.user) {
        this.setUserFromSession(data.user);
        return { success: true };
      }

      return { success: false, error: 'Identifiants ou profil introuvable.' };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Une erreur inconnue est survenue.';
      return { success: false, error: errMsg };
    }
  }

  /**
   * Inscription d'un nouvel utilisateur dans Supabase
   */
  async register(email: string, password: string, displayName: string, role: 'admin' | 'user' = 'user'): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabaseService.adminSignUp(email, password, displayName, role);
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Erreur lors de l'inscription.";
      return { success: false, error: errMsg };
    }
  }

  /**
   * Envoi de l'email de réinitialisation du mot de passe
   */
  async resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Dans le cas d'une app Angular locale, on redirige vers /reset-password
      const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : '';
      const { error } = await this.supabaseService.resetPasswordEmail(email, redirectUrl);
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Erreur de réinitialisation.";
      return { success: false, error: errMsg };
    }
  }

  /**
   * Mise à jour du mot de passe utilisateur
   */
  async updatePassword(password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabaseService.updatePassword(password);
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Erreur de mise à jour du mot de passe.";
      return { success: false, error: errMsg };
    }
  }

  /**
   * Mise à jour du profil utilisateur connecté
   */
  async updateProfile(displayName: string, avatarUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabaseService.updateProfile(displayName, avatarUrl);
      if (error) {
        return { success: false, error: error.message };
      }
      
      // Mettre à jour l'état local également
      const current = this.currentUserSignal();
      if (current) {
        const updated = { ...current, displayName, avatarUrl };
        this.currentUserSignal.set(updated);
      }
      return { success: true };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Erreur de mise à jour du profil.";
      return { success: false, error: errMsg };
    }
  }

  /**
   * Déconnexion complète
   */
  async logout(): Promise<void> {
    try {
      await this.supabaseService.signOut();
    } catch (e) {
      console.warn('Erreur lors de la déconnexion Supabase', e);
    }
    this.currentUserSignal.set(null);
  }

  /**
   * Vérifie si l'utilisateur possède certains rôles autorisés
   */
  hasRole(allowedRoles: string[]): boolean {
    const user = this.currentUserSignal();
    if (!user) return false;
    return allowedRoles.includes(user.role);
  }
}

