import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {AuthService} from '../../core/services/auth.service';
import {Router} from '@angular/router';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-dashboard',
  imports: [],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly currentUser = this.authService.currentUser;

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
