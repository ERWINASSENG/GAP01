import {inject, PLATFORM_ID} from '@angular/core';
import {isPlatformBrowser} from '@angular/common';
import {CanActivateFn, Router} from '@angular/router';
import {AuthService} from '../services/auth.service';

export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  // During SSR, we can't reliably check localStorage-based sessions
  // We allow the route to render, and the client will take over and redirect if needed
  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  await authService.waitForSession();

  if (authService.isAuthenticated()) {
    return true;
  }

  // Redirection vers l'interface de connexion si non authentifié
  return router.createUrlTree(['/login']);
};
