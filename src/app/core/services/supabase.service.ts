import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User, AuthResponse, Session, AuthError } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    let url = environment.supabaseUrl;
    if (!url || !url.startsWith('http')) {
      url = 'https://jwpigzkxkbszxzngfepn.supabase.co';
    }
    this.supabase = createClient(url, environment.supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    });
  }

  /**
   * Récupère l'instance brute du client Supabase
   */
  get client(): SupabaseClient {
    return this.supabase;
  }

  /**
   * Inscription d'un nouvel utilisateur
   */
  async signUp(email: string, password: string, displayName: string, role: 'admin' | 'user' = 'user'): Promise<AuthResponse> {
    return await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          role: role,
          avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
        }
      }
    });
  }

  /**
   * Connexion d'un utilisateur
   */
  async signIn(email: string, password: string): Promise<AuthResponse> {
    return await this.supabase.auth.signInWithPassword({
      email,
      password
    });
  }

  /**
   * Déconnexion
   */
  async signOut(): Promise<{ error: AuthError | null }> {
    return await this.supabase.auth.signOut();
  }

  /**
   * Envoi d'un email de réinitialisation de mot de passe
   */
  async resetPasswordEmail(email: string, redirectTo: string): Promise<{ error: AuthError | null }> {
    return await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo
    });
  }

  /**
   * Mise à jour du mot de passe de l'utilisateur connecté
   */
  async updatePassword(password: string): Promise<UserResponse> {
    const response = await this.supabase.auth.updateUser({
      password
    });
    return response as UserResponse;
  }

  /**
   * Mise à jour des métadonnées de l'utilisateur connecté (nom, avatar, etc.)
   */
  async updateProfile(displayName: string, avatarUrl: string): Promise<UserResponse> {
    const response = await this.supabase.auth.updateUser({
      data: {
        display_name: displayName,
        avatar_url: avatarUrl
      }
    });
    return response as UserResponse;
  }

  /**
   * Récupère l'utilisateur actuellement connecté
   */
  async getCurrentUser(): Promise<User | null> {
    const { data: { user } } = await this.supabase.auth.getUser();
    return user;
  }

  /**
   * Récupère la session courante
   */
  async getSession(): Promise<Session | null> {
    const { data: { session } } = await this.supabase.auth.getSession();
    return session;
  }

  /**
   * S'abonne aux changements d'état d'authentification
   */
  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    return this.supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
  }
}

interface UserResponse {
  data: { user: User | null };
  error: AuthError | null;
}
