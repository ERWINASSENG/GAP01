import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit, DestroyRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, FormArray, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CahierService } from '../../../core/services/cahier.service';
import { Operation, MonthlySummary, ChargementItem } from '../../../shared/models/cahier.model';

interface OperationFormValue {
  site?: string;
  type?: string;
  date?: string;
  heure?: string;
  quantite?: number | null;
  produit?: string | null;
  destination?: string | null;
  sonLevel?: string | null;
  frequence?: string | null;
  details?: string | null;
  items?: Partial<ChargementItem>[];
}

@Component({
  selector: 'app-cahier',
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  templateUrl: './cahier.component.html',
  styleUrl: './cahier.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CahierComponent implements OnInit {
  readonly cahierService = inject(CahierService);
  private readonly destroyRef = inject(DestroyRef);

  // UI state signals
  readonly isCreationPageOpen = signal<boolean>(false);
  readonly currentStep = signal<number>(1); // Step 1: Site, Step 2: Type, Step 3: Form & Table
  readonly selectedSummary = signal<MonthlySummary | null>(null);
  readonly activeDraftId = signal<string | null>(null);
  readonly globalDnPrefix = signal<string>('DN');

  // Available options
  readonly sites = ['Douala', 'Yaoundé', 'Kribi', 'AFISA'];
  readonly operationTypes = ['Chargement', 'Déchargement', 'Surmontage', 'Transfert', 'Son'] as const;
  readonly sonLevels = ['Faible', 'Moyen', 'Élevé'];
  readonly frequences = ['Basse', 'Moyenne', 'Haute'];

  // Form group definition
  readonly operationForm = new FormGroup({
    site: new FormControl<string>('', { validators: [Validators.required], nonNullable: true }),
    type: new FormControl<string>('', { validators: [Validators.required], nonNullable: true }),
    date: new FormControl<string>(new Date().toISOString().split('T')[0], { validators: [Validators.required], nonNullable: true }),
    heure: new FormControl<string>(new Date().toTimeString().slice(0, 5), { validators: [Validators.required], nonNullable: true }),
    quantite: new FormControl<number | null>(null),
    produit: new FormControl<string>(''),
    destination: new FormControl<string>(''),
    sonLevel: new FormControl<string>('Moyen'),
    frequence: new FormControl<string>('Basse'),
    details: new FormControl<string>(''),
    items: new FormArray<FormGroup>([])
  });

  // Track active form values as a signal for instant preview (Step 3)
  readonly formValue = signal<OperationFormValue>({});

  get itemsFormArray(): FormArray {
    return this.operationForm.get('items') as FormArray;
  }

  createItemFormGroup(date = '', dn = '', produit = '', qte: number | null = null, pu: number | null = null, montant: number | null = null): FormGroup {
    let prefix = this.globalDnPrefix();
    let num = '';
    if (dn) {
      const upperDn = dn.toUpperCase().trim();
      if (upperDn.startsWith('LTI ')) {
        prefix = 'LTI';
        num = dn.slice(4).trim();
      } else if (upperDn.startsWith('ISTI ')) {
        prefix = 'ISTI';
        num = dn.slice(5).trim();
      } else if (upperDn.startsWith('DN ')) {
        prefix = 'DN';
        num = dn.slice(3).trim();
      } else {
        const spaceIdx = dn.indexOf(' ');
        if (spaceIdx !== -1) {
          const possiblePrefix = dn.slice(0, spaceIdx).toUpperCase();
          if (['DN', 'LTI', 'ISTI'].includes(possiblePrefix)) {
            prefix = possiblePrefix;
            num = dn.slice(spaceIdx + 1).trim();
          } else {
            prefix = this.globalDnPrefix();
            num = dn.trim();
          }
        } else {
          if (upperDn.startsWith('LTI')) {
            prefix = 'LTI';
            num = dn.slice(3).trim();
          } else if (upperDn.startsWith('ISTI')) {
            prefix = 'ISTI';
            num = dn.slice(4).trim();
          } else if (upperDn.startsWith('DN')) {
            prefix = 'DN';
            num = dn.slice(2).trim();
          } else {
            prefix = this.globalDnPrefix();
            num = dn.trim();
          }
        }
      }
    }

    const group = new FormGroup({
      date: new FormControl<string>(date || this.operationForm.controls.date.value || '', { validators: [Validators.required], nonNullable: true }),
      dnPrefix: new FormControl<string>(prefix, { validators: [Validators.required], nonNullable: true }),
      dnNumber: new FormControl<string>(num, { validators: [Validators.required], nonNullable: true }),
      dn: new FormControl<string>(dn || `${prefix} ${num}`.toUpperCase().trim(), { validators: [Validators.required], nonNullable: true }),
      produit: new FormControl<string>(produit, { validators: [Validators.required], nonNullable: true }),
      qte: new FormControl<number | null>(qte, { validators: [Validators.required, Validators.min(0)] }),
      pu: new FormControl<number | null>(pu, { validators: [Validators.required, Validators.min(0)] }),
      montant: new FormControl<number | null>(montant, { validators: [Validators.required, Validators.min(0)] })
    });

    // Auto-calculate montant when qte or pu changes, and dn when prefix or number changes
    group.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(v => {
      const calculatedMontant = (Number(v.qte) || 0) * (Number(v.pu) || 0);
      let changed = false;
      
      if (group.controls['montant'].value !== calculatedMontant) {
        group.controls['montant'].setValue(calculatedMontant, { emitEvent: false });
        changed = true;
      }

      // Dropdown selection (dnPrefix + dnNumber) should only apply to 'Chargement' type
      if (this.operationForm.value.type === 'Chargement') {
        const rawNum = (v.dnNumber || '').toString().trim();
        const calculatedDn = `${v.dnPrefix || 'DN'} ${rawNum}`.toUpperCase().trim();
        if (group.controls['dn'].value !== calculatedDn) {
          group.controls['dn'].setValue(calculatedDn, { emitEvent: false });
          changed = true;
        }
      }

      if (changed) {
        this.operationForm.updateValueAndValidity({ emitEvent: true });
        this.formValue.set(this.operationForm.value as OperationFormValue);
      }
    });

    return group;
  }

  addItemRow() {
    const opDate = this.operationForm.controls.date.value || new Date().toISOString().split('T')[0];
    const group = this.createItemFormGroup(opDate);
    this.itemsFormArray.push(group);
    
    // Auto-calculate montant if they want, but let's keep direct input and listen to value changes to update signal
    this.operationForm.updateValueAndValidity();
    this.formValue.set(this.operationForm.value as OperationFormValue);
  }

  removeItemRow(index: number) {
    this.itemsFormArray.removeAt(index);
    this.operationForm.updateValueAndValidity();
    this.formValue.set(this.operationForm.value as OperationFormValue);
  }

  onGlobalPrefixChange(newPrefix: string) {
    this.globalDnPrefix.set(newPrefix);
  }

  constructor() {
    effect(() => {
      const isOpen = this.isCreationPageOpen();
      const step = this.currentStep();
      const draftId = this.activeDraftId();
      const prefix = this.globalDnPrefix();
      
      this.saveTemporaryState(isOpen, step, draftId, prefix);
    });
  }

  private saveTemporaryState(
    isOpen = this.isCreationPageOpen(),
    step = this.currentStep(),
    draftId = this.activeDraftId(),
    prefix = this.globalDnPrefix()
  ) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    
    if (!isOpen) {
      localStorage.removeItem('cahier_temporary_form_state');
      return;
    }

    const formRaw = this.operationForm.getRawValue();
    const stateToSave = {
      isOpen,
      step,
      draftId,
      prefix,
      formRaw
    };

    localStorage.setItem('cahier_temporary_form_state', JSON.stringify(stateToSave));
  }

  private restoreTemporaryState() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    
    const saved = localStorage.getItem('cahier_temporary_form_state');
    if (!saved) return;

    try {
      const state = JSON.parse(saved);
      if (state && state.isOpen) {
        this.activeDraftId.set(state.draftId || null);
        this.globalDnPrefix.set(state.prefix || 'DN');
        
        if (state.formRaw) {
          const raw = state.formRaw;
          this.operationForm.patchValue({
            site: raw.site,
            type: raw.type,
            date: raw.date,
            heure: raw.heure,
            quantite: raw.quantite,
            produit: raw.produit,
            destination: raw.destination,
            sonLevel: raw.sonLevel,
            frequence: raw.frequence,
            details: raw.details
          }, { emitEvent: false });

          this.itemsFormArray.clear();
          if (raw.items && Array.isArray(raw.items)) {
            raw.items.forEach((item: Partial<ChargementItem>) => {
              this.itemsFormArray.push(this.createItemFormGroup(
                item.date,
                item.dn,
                item.produit,
                item.qte,
                item.pu,
                item.montant
              ));
            });
          }
        }

        this.currentStep.set(state.step || 1);
        this.isCreationPageOpen.set(true);
      }
    } catch (e) {
      console.error('Error restoring temporary form state:', e);
      localStorage.removeItem('cahier_temporary_form_state');
    }
  }

  ngOnInit() {
    // Restore state from localStorage if exists
    this.restoreTemporaryState();

    // Sync form changes to our formValue signal for live preview
    this.formValue.set(this.operationForm.value as OperationFormValue);
    this.operationForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(val => {
        this.formValue.set(val as OperationFormValue);
        this.saveTemporaryState();
      });
  }

  // Live preview computed signal
  readonly livePreview = computed<Partial<Operation>>(() => {
    const val = this.formValue();
    return {
      site: val.site || 'Non défini',
      type: val.type as Operation['type'],
      date: val.date || '',
      heure: val.heure || '',
      details: val.details || '',
      items: (val.items as Partial<ChargementItem>[] || []).map(item => ({
        date: item.date || '',
        dn: item.dn || '',
        produit: item.produit || '',
        qte: Number(item.qte) || 0,
        pu: Number(item.pu) || 0,
        montant: Number(item.montant) || 0
      }))
    };
  });

  // Calculate instant total of table items
  readonly totalChargement = computed<number>(() => {
    const val = this.formValue();
    if (!val.items || !Array.isArray(val.items)) return 0;
    return val.items.reduce((sum: number, item: Partial<ChargementItem>) => sum + (Number(item?.montant) || 0), 0);
  });

  getOperationTotal(op: Operation): number {
    if (!op || !op.items || !Array.isArray(op.items)) return 0;
    return op.items.reduce((sum: number, item: ChargementItem) => sum + (Number(item?.montant) || 0), 0);
  }

  // Opens the creation page view
  openNewOperationModal() {
    this.itemsFormArray.clear();
    this.activeDraftId.set(null);
    this.operationForm.reset({
      site: '',
      type: '',
      date: new Date().toISOString().split('T')[0],
      heure: new Date().toTimeString().slice(0, 5),
      quantite: null,
      produit: '',
      destination: '',
      sonLevel: 'Moyen',
      frequence: 'Basse',
      details: ''
    });
    this.currentStep.set(1);
    this.isCreationPageOpen.set(true);
  }

  // Opens form from an existing draft
  editDraft(draft: Operation) {
    this.itemsFormArray.clear();
    this.activeDraftId.set(draft.id);
    
    this.operationForm.patchValue({
      site: draft.site,
      type: draft.type,
      date: draft.date,
      heure: draft.heure,
      quantite: draft.quantite !== undefined ? draft.quantite : null,
      produit: draft.produit || '',
      destination: draft.destination || '',
      sonLevel: draft.sonLevel || 'Moyen',
      frequence: draft.frequence || 'Basse',
      details: draft.details || ''
    });

    if (draft.items && draft.items.length > 0) {
      draft.items.forEach(item => {
        this.itemsFormArray.push(this.createItemFormGroup(
          item.date,
          item.dn,
          item.produit,
          item.qte,
          item.pu,
          item.montant
        ));
      });
    }

    this.currentStep.set(3); // Go directly to detailed stage
    this.isCreationPageOpen.set(true);
  }

  // Save/Update the draft and quit the wizard
  async saveAsDraft() {
    const val = this.operationForm.getRawValue();
    const draftData: Partial<Operation> = {
      id: this.activeDraftId() || undefined,
      site: val.site || undefined,
      type: val.type as Operation['type'] || undefined,
      date: val.date || undefined,
      heure: val.heure || undefined,
      details: val.details || undefined,
      quantite: val.quantite !== null ? val.quantite : undefined,
      produit: val.produit || undefined,
      destination: val.destination || undefined,
      sonLevel: val.sonLevel || undefined,
      frequence: val.frequence || undefined,
      items: (val.items as Partial<ChargementItem>[] || []).map(item => ({
        date: item.date || val.date || '',
        dn: item.dn || '',
        produit: item.produit || '',
        qte: item.qte !== null ? Number(item.qte) : 0,
        pu: item.pu !== null ? Number(item.pu) : 0,
        montant: item.montant !== null ? Number(item.montant) : 0
      }))
    };

    await this.cahierService.saveDraft(draftData);
    this.isCreationPageOpen.set(false);
  }

  async closeModal() {
    // Check if the table has actual data filled in
    const hasTableData = this.itemsFormArray.controls.some(group => {
      const v = group.value;
      return (v.produit && v.produit.trim() !== '') || 
             (v.qte !== null && Number(v.qte) > 0) || 
             (v.pu !== null && Number(v.pu) > 0) ||
             (v.dnNumber && v.dnNumber.trim() !== '');
    });
    
    if (hasTableData) {
      await this.saveAsDraft();
      return;
    }
    
    this.isCreationPageOpen.set(false);
  }

  // Auto-selection triggers transition
  selectSite(siteOption: string) {
    this.operationForm.patchValue({ site: siteOption });
    this.goToStep2();
  }

  selectType(typeOption: string) {
    this.operationForm.patchValue({ type: typeOption });
    this.goToStep3();
  }

  // Transitions to Step 2 if Site is valid
  goToStep2() {
    const siteCtrl = this.operationForm.controls.site;
    siteCtrl.markAsTouched();
    if (siteCtrl.valid) {
      this.currentStep.set(2);
    }
  }

  // Transitions to Step 3 if Type is valid
  goToStep3() {
    const typeCtrl = this.operationForm.controls.type;
    typeCtrl.markAsTouched();
    if (typeCtrl.valid) {
      // Clear legacy validators for separate fields
      this.operationForm.controls.quantite.clearValidators();
      this.operationForm.controls.produit.clearValidators();
      this.operationForm.controls.destination.clearValidators();

      this.operationForm.controls.quantite.updateValueAndValidity();
      this.operationForm.controls.produit.updateValueAndValidity();
      this.operationForm.controls.destination.updateValueAndValidity();

      // Ensure at least one line is present when opening the step 3 form
      if (this.itemsFormArray.length === 0) {
        const opDate = this.operationForm.controls.date.value || new Date().toISOString().split('T')[0];
        this.itemsFormArray.push(this.createItemFormGroup(opDate));
      }

      this.currentStep.set(3);
    }
  }

  // Submits the newly created operation
  async onSubmit() {
    if (this.operationForm.invalid) {
      this.operationForm.markAllAsTouched();
      return;
    }

    const val = this.operationForm.getRawValue();
    const opData: Omit<Operation, 'id' | 'collaborateur'> & { id?: string } = {
      id: this.activeDraftId() || undefined,
      site: val.site,
      type: val.type as Operation['type'],
      date: val.date,
      heure: val.heure,
      details: val.details || undefined,
      items: (val.items as Partial<ChargementItem>[] || []).map(item => ({
        date: item.date || '',
        dn: item.dn || '',
        produit: item.produit || '',
        qte: Number(item.qte) || 0,
        pu: Number(item.pu) || 0,
        montant: Number(item.montant) || 0
      }))
    };

    await this.cahierService.addOperation(opData);
    this.isCreationPageOpen.set(false); // Close directly, bypassing dirty closeModal check

    // If a summary was detailed, keep it updated or refresh active view
    if (this.selectedSummary()) {
      const activeSum = this.selectedSummary()!;
      // Find updated matching operations for the active summary grouping
      const allOps = this.cahierService.operations();
      const updatedOps = allOps.filter(o => {
        if (!o || !o.date || typeof o.date !== 'string') return false;
        // Extract French month name to match
        const dateParts = o.date.split('-');
        if (dateParts.length < 2) return false;
        const year = dateParts[0];
        const monthNum = parseInt(dateParts[1], 10);
        const monthsFrench = [
          'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
          'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
        ];
        const monthFrench = monthsFrench[monthNum - 1] || 'Inconnu';
        const key = `${monthFrench} ${year}`;
        return key === activeSum.month && o.site === activeSum.site && o.type === activeSum.type;
      });

      if (updatedOps.length > 0) {
        this.selectedSummary.set({
          ...activeSum,
          count: updatedOps.length,
          operations: updatedOps
        });
      } else {
        this.selectedSummary.set(null);
      }
    }
  }

  // Deletes an operation with local confirmation
  async deleteOp(id: string) {
    if (confirm('Voulez-vous vraiment supprimer cette opération ?')) {
      await this.cahierService.deleteOperation(id);
      
      // Update detailed view if selected
      if (this.selectedSummary()) {
        const activeSum = this.selectedSummary()!;
        const updatedOps = activeSum.operations.filter(op => op.id !== id);
        if (updatedOps.length > 0) {
          this.selectedSummary.set({
            ...activeSum,
            count: updatedOps.length,
            operations: updatedOps
          });
        } else {
          this.selectedSummary.set(null);
        }
      }
    }
  }

  // Set detailed summary view
  showDetail(summary: MonthlySummary) {
    this.selectedSummary.set(summary);
  }

  // Clear detailed summary and return to main monthly table
  backToMonthly() {
    this.selectedSummary.set(null);
  }

  // Returns operations grouped by day of the week for detailed view
  readonly detailedDays = computed(() => {
    const summary = this.selectedSummary();
    if (!summary) return [];

    const daysFrench = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    
    // Group operations by exact date
    const groups: Record<string, { dateLabel: string; ops: Operation[] }> = {};

    summary.operations.forEach(op => {
      if (!op || !op.date || typeof op.date !== 'string') return;
      const d = new Date(op.date);
      if (isNaN(d.getTime())) return;
      const dayName = daysFrench[d.getDay()];
      const dayNum = d.getDate();
      const monthNames = [
        'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
        'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
      ];
      const monthName = monthNames[d.getMonth()];
      const dateLabel = `${dayName} ${dayNum === 1 ? '01er' : dayNum} ${monthName}`;

      if (!groups[op.date]) {
        groups[op.date] = { dateLabel, ops: [] };
      }
      groups[op.date].ops.push(op);
    });

    // Sort by date ascending or descending as needed
    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map(dateKey => ({
        date: dateKey,
        dateLabel: groups[dateKey].dateLabel,
        ops: groups[dateKey].ops
      }));
  });

  // Export the operations to an Excel-compatible CSV file
  exportToExcel() {
    const summary = this.selectedSummary();
    if (!summary) return;

    const csvRows: string[] = [];
    
    // UTF-8 BOM so Excel opens it with correct French accents
    csvRows.push('\ufeff');

    // Document Headers
    csvRows.push(`"RAPPORT D'OPERATIONS - ${summary.type.toUpperCase()}"`);
    csvRows.push(`"Site","${summary.site}"`);
    csvRows.push(`"Periode","${summary.month}"`);
    csvRows.push(`"Nombre d'operations","${summary.count}"`);
    csvRows.push(''); // Empty line separator

    // Table Headers
    csvRows.push('"Date","Heure","DN","Produit","Quantite","PU","Montant (FCFA)","Observations","Collaborateur"');

    // Process operations by date
    this.detailedDays().forEach(dayGroup => {
      dayGroup.ops.forEach(op => {
        if (op.items && op.items.length > 0) {
          op.items.forEach(item => {
            const row = [
              `"${item.date}"`,
              `"${op.heure}"`,
              `"${item.dn}"`,
              `"${item.produit}"`,
              `"${item.qte}"`,
              `"${item.pu}"`,
              `"${item.montant}"`,
              `"${(op.details || '').replace(/"/g, '""')}"`,
              `"${op.collaborateur || ''}"`
            ];
            csvRows.push(row.join(','));
          });
        } else {
          const row = [
            `"${op.date}"`,
            `"${op.heure}"`,
            '""',
            '""',
            '""',
            '""',
            '""',
            `"${(op.details || '').replace(/"/g, '""')}"`,
            `"${op.collaborateur || ''}"`
          ];
          csvRows.push(row.join(','));
        }
      });
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Rapport_Operations_${summary.site}_${summary.type}_${summary.month.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Export the operations to a beautifully styled print view / PDF
  exportToPDF() {
    const summary = this.selectedSummary();
    if (!summary) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Veuillez autoriser les fenêtres contextuelles pour exporter le rapport en PDF.');
      return;
    }

    const title = `Rapport d'Opérations - ${summary.type} (${summary.site})`;
    
    let rowsHtml = '';
    this.detailedDays().forEach(dayGroup => {
      dayGroup.ops.forEach(op => {
        const items = op.items;
        if (items && items.length > 0) {
          const len = items.length;
          items.forEach((item, index) => {
            rowsHtml += `
              <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
                ${index === 0 ? `<td rowspan="${len}" style="padding: 8px; border-right: 1px solid #e2e8f0; font-weight: bold; vertical-align: top;">${dayGroup.dateLabel}<br><small style="color: #64748b; font-weight: normal;">${op.heure}</small></td>` : ''}
                <td style="padding: 8px; border-right: 1px solid #e2e8f0; text-align: center;">${item.dn}</td>
                <td style="padding: 8px; border-right: 1px solid #e2e8f0;">${item.produit}</td>
                <td style="padding: 8px; border-right: 1px solid #e2e8f0; text-align: right;">${Number(item.qte).toLocaleString('fr-FR')}</td>
                <td style="padding: 8px; border-right: 1px solid #e2e8f0; text-align: right;">${Number(item.pu).toLocaleString('fr-FR')}</td>
                <td style="padding: 8px; border-right: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #4f46e5;">${Number(item.montant).toLocaleString('fr-FR')} FCFA</td>
                ${index === 0 ? `<td rowspan="${len}" style="padding: 8px; border-right: 1px solid #e2e8f0; color: #475569; vertical-align: top;">${op.details || '-'}</td>` : ''}
                ${index === 0 ? `<td rowspan="${len}" style="padding: 8px; color: #475569; vertical-align: top;">${op.collaborateur || '-'}</td>` : ''}
              </tr>
            `;
          });
        } else {
          rowsHtml += `
            <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
              <td style="padding: 8px; border-right: 1px solid #e2e8f0; font-weight: bold; vertical-align: top;">${dayGroup.dateLabel}<br><small style="color: #64748b; font-weight: normal;">${op.heure}</small></td>
              <td style="padding: 8px; border-right: 1px solid #e2e8f0; text-align: center;" colspan="5">Aucun article enregistré</td>
              <td style="padding: 8px; border-right: 1px solid #e2e8f0; color: #475569; vertical-align: top;">${op.details || '-'}</td>
              <td style="padding: 8px; color: #475569; vertical-align: top;">${op.collaborateur || '-'}</td>
            </tr>
          `;
        }
      });
    });

    let grandTotal = 0;
    this.detailedDays().forEach(dayGroup => {
      dayGroup.ops.forEach(op => {
        grandTotal += this.getOperationTotal(op);
      });
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <meta charset="utf-8">
        <style>
          body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            color: #1e293b;
            margin: 40px;
            line-height: 1.5;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #4f46e5;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header-title h1 {
            font-size: 20px;
            font-weight: 800;
            margin: 0 0 5px 0;
            color: #0f172a;
            letter-spacing: -0.025em;
          }
          .header-title p {
            margin: 0;
            font-size: 12px;
            color: #64748b;
          }
          .meta-box {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px 20px;
            font-size: 12px;
          }
          .meta-item {
            margin-bottom: 4px;
          }
          .meta-item:last-child {
            margin-bottom: 0;
          }
          .meta-label {
            font-weight: bold;
            color: #64748b;
            margin-right: 5px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          th {
            background-color: #f1f5f9;
            color: #475569;
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            padding: 10px 8px;
            border: 1px solid #e2e8f0;
            text-align: left;
          }
          td {
            border: 1px solid #e2e8f0;
          }
          .total-section {
            display: flex;
            justify-content: flex-end;
            margin-top: 20px;
          }
          .total-box {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 15px 25px;
            font-size: 14px;
            font-weight: bold;
          }
          .total-label {
            color: #64748b;
            margin-right: 15px;
          }
          .total-val {
            color: #4f46e5;
            font-size: 16px;
          }
          .footer {
            margin-top: 50px;
            border-top: 1px solid #e2e8f0;
            padding-top: 15px;
            text-align: center;
            font-size: 10px;
            color: #94a3b8;
          }
          @media print {
            body {
              margin: 20px;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-title">
            <h1>RAPPORT JOURNALIER D'OPÉRATIONS</h1>
            <p>Saisie et suivi des activités d'exploitation SCMC</p>
          </div>
          <div class="meta-box">
            <div class="meta-item"><span class="meta-label">Site :</span> ${summary.site}</div>
            <div class="meta-item"><span class="meta-label">Type :</span> ${summary.type}</div>
            <div class="meta-item"><span class="meta-label">Période :</span> ${summary.month}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 15%;">Date & Heure</th>
              <th style="width: 10%; text-align: center;">DN</th>
              <th style="width: 18%;">Produit</th>
              <th style="width: 10%; text-align: right;">Qté</th>
              <th style="width: 10%; text-align: right;">PU</th>
              <th style="width: 15%; text-align: right;">Montant</th>
              <th style="width: 20%;">Observations</th>
              <th style="width: 12%;">Collaborateur</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="total-section">
          <div class="total-box">
            <span class="total-label">Montant Global :</span>
            <span class="total-val">${grandTotal.toLocaleString('fr-FR')} FCFA</span>
          </div>
        </div>

        <div class="footer">
          Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')} | SCMC Operations Digitales
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
}

