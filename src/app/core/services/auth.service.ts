import {Injectable, signal, computed, inject} from '@angular/core';
import {PortUser} from '../../shared/models/auth.model';
import {SupabaseService} from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly supabaseService = inject(SupabaseService);

  // Mock users database
  private getMockUsers(): (PortUser & { password?: string })[] {
    const defaults: (PortUser & { password?: string })[] = [
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

    if (typeof window !== 'undefined') {
      try {
        const localData = localStorage.getItem('port_local_registered_users');
        if (localData) {
          const parsed = JSON.parse(localData);
          if (Array.isArray(parsed)) {
            return [...defaults, ...parsed];
          }
        }
      } catch (e) {
        console.error('Failed to parse local registered users', e);
      }
    }
    return defaults;
  }

  private saveUserLocally(email: string, password: string, displayName: string, role: 'admin' | 'user'): void {
    if (typeof window === 'undefined') return;
    try {
      const localData = localStorage.getItem('port_local_registered_users');
      const users: (PortUser & { password?: string })[] = localData ? JSON.parse(localData) : [];
      
      // Avoid duplicates
      if (!users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        const newUser: PortUser & { password?: string } = {
          id: `usr-local-${Date.now()}`,
          email: email,
          username: email.split('@')[0] || 'user',
          displayName: displayName,
          role: role,
          avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
          assignedSiteId: 'site-1',
          assignedSiteName: 'Terminal à Conteneurs A',
          password: password // Store password temporarily for local fallback testing
        };
        users.push(newUser);
        localStorage.setItem('port_local_registered_users', JSON.stringify(users));
      }
    } catch (e) {
      console.error('Failed to save user locally', e);
    }
  }

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
        if (current && !this.getMockUsers().some(mu => mu.email === current.email)) {
          this.currentUserSignal.set(null);
          this.clearSessionFromStorage();
        }
      }
    });
  }

  /**
   * Connexion d'un utilisateur (avec repli vers les comptes de démo et comptes locaux)
   */
  async login(email: string, password?: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (password) {
        // Tenter la connexion réelle avec Supabase
        const { data, error } = await this.supabaseService.signIn(email, password);
        if (error) {
          // Si échec Supabase, vérification si c'est un compte de démonstration ou compte local
          const demoUser = this.getMockUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
          if (demoUser) {
            // Si le compte local requiert un mot de passe et qu'il ne correspond pas
            if (demoUser.password && demoUser.password !== password) {
              return { success: false, error: 'Mot de passe incorrect pour ce compte.' };
            }
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
        const demoUser = this.getMockUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
        if (demoUser) {
          this.currentUserSignal.set(demoUser);
          this.saveSessionToStorage(demoUser);
          return { success: true };
        }
      }
      return { success: false, error: 'Identifiants ou profil introuvable.' };
    } catch (err: unknown) {
      // Fallback en cas de panne réseau ou blocage Supabase (ex: TypeError: Failed to fetch)
      console.warn('Supabase signIn failed or network error. Using local fallback.', err);
      const demoUser = this.getMockUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
      if (demoUser) {
        if (!password || (demoUser.password && demoUser.password === password) || !demoUser.password) {
          this.currentUserSignal.set(demoUser);
          this.saveSessionToStorage(demoUser);
          return { success: true };
        } else if (demoUser.password && demoUser.password !== password) {
          return { success: false, error: 'Mot de passe incorrect pour ce compte.' };
        }
      }
      const errMsg = err instanceof Error ? err.message : 'Une erreur inconnue est survenue.';
      return { success: false, error: errMsg };
    }
  }

  /**
   * Inscription d'un nouvel utilisateur dans Supabase (avec repli local automatique s'il y a une erreur ou restriction d'email)
   */
  async register(email: string, password: string, displayName: string, role: 'admin' | 'user' = 'user'): Promise<{ success: boolean; isLocal?: boolean; error?: string }> {
    try {
      const { error } = await this.supabaseService.signUp(email, password, displayName, role);
      if (error) {
        // Si Supabase renvoie une erreur (par exemple confirmation d'e-mail requise ou inscription désactivée)
        console.warn('Supabase signUp failed or needs confirmation. Fallback to local storage:', error.message);
        this.saveUserLocally(email, password, displayName, role);
        return { success: true, isLocal: true, error: error.message };
      }
      return { success: true, isLocal: false };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Erreur lors de l'inscription.";
      console.warn('Supabase error, saving locally:', errMsg);
      this.saveUserLocally(email, password, displayName, role);
      return { success: true, isLocal: true, error: errMsg };
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

