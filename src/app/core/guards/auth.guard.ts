import {inject} from '@angular/core';
import {CanActivateFn, Router} from '@angular/router';
import {AuthService} from '../services/auth.service';

export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.waitForSession();

  if (authService.isAuthenticated()) {
    return true;
  }

  // Redirection vers l'interface de connexion si non authentifié
  return router.createUrlTree(['/login']);
};
