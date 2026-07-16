import {Routes} from '@angular/router';
import {authGuard} from './core/guards/auth.guard';
import {roleGuard} from './core/guards/role.guard';
import {LoginComponent} from './features/page/login/login.component';
import {RegisterComponent} from './features/page/register/register.component';
import {ResetComponent} from './features/page/reset/reset.component';
import {ProtectedLayout} from './features/protected/layout';
import {DashboardComponent} from './features/dashboard/dashboard.component';
import {CahierComponent} from './features/page/cahier/cahier.component';
import {AdminCahierViewComponent} from './features/admin/cahier-view/cahier-view.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    title: 'PortSync Pro - Connexion'
  },
  {
    path: 'reset',
    component: ResetComponent,
    title: 'PortSync Pro - Réinitialisation de mot de passe'
  },
  {
    path: 'reset-password',
    component: ResetComponent,
    title: 'PortSync Pro - Réinitialisation de mot de passe'
  },
  {
    path: '',
    component: ProtectedLayout,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        component: DashboardComponent,
        title: 'PortSync Pro - Tableau de bord'
      },
      {
        path: 'cahier',
        component: CahierComponent,
        title: 'PortSync Pro - Cahier d\'Opérations'
      },
      {
        path: 'admin/view',
        component: AdminCahierViewComponent,
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        title: 'PortSync Pro - Administration'
      },
      {
        path: 'admin/register',
        component: RegisterComponent,
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        title: 'PortSync Pro - Créer un collaborateur'
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
