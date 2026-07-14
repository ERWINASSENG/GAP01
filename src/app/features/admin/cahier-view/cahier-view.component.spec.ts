import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminCahierViewComponent } from './cahier-view.component';
import { CahierService } from '../../../core/services/cahier.service';
import { PdfExportService } from '../../../core/services/pdf-export.service';
import { signal } from '@angular/core';

describe('AdminCahierViewComponent', () => {
  let component: AdminCahierViewComponent;
  let fixture: ComponentFixture<AdminCahierViewComponent>;
  let mockCahierService: Partial<CahierService>;
  let mockPdfExportService: Partial<PdfExportService>;

  beforeEach(async () => {
    mockCahierService = {
      adminMonthlySummaries: signal([])
    };
    mockPdfExportService = {
      exportMonthlySummary: jasmine.createSpy('exportMonthlySummary')
    };

    await TestBed.configureTestingModule({
      imports: [AdminCahierViewComponent],
      providers: [
        { provide: CahierService, useValue: mockCahierService },
        { provide: PdfExportService, useValue: mockPdfExportService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminCahierViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
