import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CahierService } from '../../../core/services/cahier.service';
import { PdfExportService } from '../../../core/services/pdf-export.service';
import { ExcelExportService } from '../../../core/services/excel-export.service';
import { MonthlySummary } from '../../../shared/models/cahier.model';
import { AuthService } from '../../../core/services/auth.service';
import { CreatedUser } from '../../../shared/models/auth.model';

@Component({
  selector: 'app-admin-cahier-view',
  imports: [CommonModule, MatIconModule],
  templateUrl: './cahier-view.component.html',
  styleUrl: './cahier-view.component.scss'
})
export class AdminCahierViewComponent implements OnInit {
  private readonly cahierService = inject(CahierService);
  private readonly pdfExportService = inject(PdfExportService);
  private readonly excelExportService = inject(ExcelExportService);
  private readonly authService = inject(AuthService);

  readonly summaries = this.cahierService.adminMonthlySummaries;

  // Signals pour les utilisateurs créés par cet admin
  readonly createdUsers = signal<CreatedUser[]>([]);
  readonly isLoadingUsers = signal<boolean>(false);
  readonly errorUsers = signal<string>('');

  ngOnInit() {
    this.loadCreatedUsers();
  }

  async loadCreatedUsers() {
    this.isLoadingUsers.set(true);
    this.errorUsers.set('');
    const res = await this.authService.getCreatedUsers();
    this.isLoadingUsers.set(false);
    if (res.success && res.users) {
      this.createdUsers.set(res.users);
    } else {
      this.errorUsers.set(res.error || 'Erreur lors du chargement des collaborateurs.');
    }
  }

  exportToPdf(summary: MonthlySummary) {
    this.pdfExportService.exportMonthlySummary(summary);
  }

  exportToExcel(summary: MonthlySummary) {
    this.excelExportService.exportMonthlySummaryToExcel(summary);
  }
}
