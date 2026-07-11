import {inject} from '@angular/core';
import {CanActivateFn, Router} from '@angular/router';
import {AuthService} from '../services/auth.service';

export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const allowedRoles = route.data?.['allowedRoles'] as string[];

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
