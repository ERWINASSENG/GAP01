import {Injectable, signal, computed, inject} from '@angular/core';
import {PortUser} from '../../shared/models/auth.model';
import {SupabaseService} from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly supabaseService = inject(SupabaseService);

  // Mock users database
  private readonly mockUsers: PortUser[] = [
    {
      id: 'usr-1',
      email: 'admin@port.gov',
      username: 'admin_port',
      displayName: 'Directrice Générale (Admin)',
      role: 'admin',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
      assignedSiteId: 'site-1',
      assignedSiteName: 'Terminal à Conteneurs A'
    },
    {
      id: 'usr-3',
      email: 'agent@port.gov',
      username: 'agent_pointeur',
      displayName: 'Pointeur Principal (User)',
      role: 'user',
      avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
      assignedSiteId: 'site-1',
      assignedSiteName: 'Terminal à Conteneurs A'
    }
  ];

  // Signals for state management
  private currentUserSignal = signal<PortUser | null>(null);
  
  // Public exposure of signals
  readonly currentUser = computed(() => this.currentUserSignal());
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);
  readonly userRole = computed(() => this.currentUserSignal()?.role || null);

  constructor() {
    this.loadSessionFromStorage();
    this.initSupabaseAuthListener();
  }

  /**
   * Initialise l'écouteur d'événements d'authentification Supabase
   */
  private initSupabaseAuthListener(): void {
    this.supabaseService.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const metadata = session.user.user_metadata || {};
        const user: PortUser = {
          id: session.user.id,
          email: session.user.email || '',
          username: session.user.email?.split('@')[0] || 'user',
          displayName: metadata['display_name'] || metadata['fullName'] || 'Collaborateur',
          role: metadata['role'] || 'user',
          avatarUrl: metadata['avatar_url'] || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
          assignedSiteId: 'site-1',
          assignedSiteName: 'Terminal à Conteneurs A'
        };
        this.currentUserSignal.set(user);
        this.saveSessionToStorage(user);
      } else if (event === 'SIGNED_OUT') {
        // Ne vider la session locale que si on n'a pas de compte démo actif ou si l'événement provient de Supabase
        const current = this.currentUserSignal();
        // Si l'utilisateur actuel n'est pas un mock user, on l'efface
        if (current && !this.mockUsers.some(mu => mu.email === current.email)) {
          this.currentUserSignal.set(null);
          this.clearSessionFromStorage();
        }
      }
    });
  }

  /**
   * Connexion d'un utilisateur (avec repli vers les comptes de démo)
   */
  async login(email: string, password?: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (password) {
        // Tenter la connexion réelle avec Supabase
        const { data, error } = await this.supabaseService.signIn(email, password);
        if (error) {
          // Si échec Supabase, vérification si c'est un compte de démonstration pour connexion fluide hors-ligne
          const demoUser = this.mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
          if (demoUser) {
            this.currentUserSignal.set(demoUser);
            this.saveSessionToStorage(demoUser);
            return { success: true };
          }
          return { success: false, error: error.message };
        }
        
        if (data.user) {
          const metadata = data.user.user_metadata || {};
          const user: PortUser = {
            id: data.user.id,
            email: data.user.email || '',
            username: data.user.email?.split('@')[0] || 'user',
            displayName: metadata['display_name'] || 'Collaborateur',
            role: metadata['role'] || 'user',
            avatarUrl: metadata['avatar_url'] || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
            assignedSiteId: 'site-1',
            assignedSiteName: 'Terminal à Conteneurs A'
          };
          this.currentUserSignal.set(user);
          this.saveSessionToStorage(user);
          return { success: true };
        }
      } else {
        // Sans mot de passe, c'est pour les raccourcis démo
        const demoUser = this.mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (demoUser) {
          this.currentUserSignal.set(demoUser);
          this.saveSessionToStorage(demoUser);
          return { success: true };
        }
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
      const { error } = await this.supabaseService.signUp(email, password, displayName, role);
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
        this.saveSessionToStorage(updated);
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
    this.clearSessionFromStorage();
  }

  /**
   * Vérifie si l'utilisateur possède certains rôles autorisés
   */
  hasRole(allowedRoles: string[]): boolean {
    const user = this.currentUserSignal();
    if (!user) return false;
    return allowedRoles.includes(user.role);
  }

  private saveSessionToStorage(user: PortUser): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('port_session_user', JSON.stringify(user));
    }
  }

  private loadSessionFromStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('port_session_user');
        if (stored) {
          const user = JSON.parse(stored) as PortUser;
          this.currentUserSignal.set(user);
        }
      } catch (e) {
        console.error('Failed to parse port session', e);
      }
    }
  }

  private clearSessionFromStorage(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('port_session_user');
    }
  }
}

