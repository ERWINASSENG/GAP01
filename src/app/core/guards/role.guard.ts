import {inject, PLATFORM_ID} from '@angular/core';
import {isPlatformBrowser} from '@angular/common';
import {CanActivateFn, Router} from '@angular/router';
import {AuthService} from '../services/auth.service';

export const roleGuard: CanActivateFn = async (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  
  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  const allowedRoles = (route.data?.['allowedRoles'] || route.data?.['roles']) as string[];

  await authService.waitForSession();

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  const currentUser = authService.currentUser();
  if (currentUser && allowedRoles && allowedRoles.includes(currentUser.role)) {
    return true;
  }

  // Rediriger vers le tableau de bord si le rôle n'a pas accès
  return router.createUrlTree(['/dashboard']);
};
