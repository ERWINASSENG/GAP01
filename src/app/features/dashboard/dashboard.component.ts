import {ChangeDetectionStrategy, Component, inject, computed, signal} from '@angular/core';
import {DecimalPipe} from '@angular/common';
import {Router} from '@angular/router';
import {AuthService} from '../../core/services/auth.service';

export interface LocalPortOperation {
  id: string;
  vesselName: string;
  voyageNumber: string;
  type: string;
  berthNumber: string;
  completedQuantity: number;
  targetQuantity: number;
  status: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-dashboard',
  imports: [DecimalPipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly currentUser = this.authService.currentUser;

  // Données de simulation locales pour le bon fonctionnement sans PortData
  readonly operations = signal<LocalPortOperation[]>([
    {
      id: 'op-1',
      vesselName: 'MV TOLEDO',
      voyageNumber: 'TLD-2026',
      type: 'Déchargement',
      berthNumber: 'Quai A3',
      completedQuantity: 18400,
      targetQuantity: 25000,
      status: 'en_cours'
    },
    {
      id: 'op-2',
      vesselName: 'MV LOMÉ EXPR',
      voyageNumber: 'LMX-990',
      type: 'Chargement',
      berthNumber: 'Appontement S1',
      completedQuantity: 8200,
      targetQuantity: 12000,
      status: 'en_cours'
    },
    {
      id: 'op-3',
      vesselName: 'MV OCEANIC',
      voyageNumber: 'OCN-442',
      type: 'Reconditionnement',
      berthNumber: 'Darse Sud',
      completedQuantity: 1500,
      targetQuantity: 2000,
      status: 'en_cours'
    }
  ]);

  readonly activeOperationsCount = computed(() => this.operations().length);
  readonly totalVolume = computed(() => 145000);
  readonly activeAgentsCount = computed(() => 12);
  readonly totalAgentsCount = computed(() => 18);
  readonly nightShiftCount = computed(() => 4);
  readonly totalRevenue = computed(() => 3500000);

  readonly activeOperations = computed(() => {
    return this.operations();
  });

  getProgressPercent(op: LocalPortOperation): number {
    if (!op.targetQuantity) return 0;
    const percent = (op.completedQuantity / op.targetQuantity) * 100;
    return percent > 100 ? 100 : percent;
  }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
