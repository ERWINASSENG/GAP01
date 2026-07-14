import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CahierService } from '../../../core/services/cahier.service';
import { PdfExportService } from '../../../core/services/pdf-export.service';
import { MonthlySummary } from '../../../shared/models/cahier.model';

@Component({
  selector: 'app-admin-cahier-view',
  imports: [CommonModule, MatIconModule],
  templateUrl: './cahier-view.component.html',
  styleUrl: './cahier-view.component.scss'
})
export class AdminCahierViewComponent {
  private readonly cahierService = inject(CahierService);
  private readonly pdfExportService = inject(PdfExportService);

  readonly summaries = this.cahierService.adminMonthlySummaries;

  exportToPdf(summary: MonthlySummary) {
    this.pdfExportService.exportMonthlySummary(summary);
  }
}
