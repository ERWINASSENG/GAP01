import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit, DestroyRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, FormArray, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CahierService } from '../../../core/services/cahier.service';
import { PdfExportService } from '../../../core/services/pdf-export.service';
import { Operation, MonthlySummary, OperationItem } from '../../../shared/models/cahier.model';

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
  items?: Partial<OperationItem>[];
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
  private readonly pdfService = inject(PdfExportService);
  private readonly destroyRef = inject(DestroyRef);

  // UI state signals
  readonly isCreationPageOpen = signal<boolean>(false);
  readonly currentStep = signal<number>(1); // Step 1: Site, Step 2: Type, Step 3: Form & Table
  readonly selectedSummaryKeys = signal<{ month: string; site: string } | null>(null);
  readonly isSaving = signal<boolean>(false);
  readonly operationToDelete = signal<string | null>(null);

  readonly selectedSummary = computed<MonthlySummary | null>(() => {
    const keys = this.selectedSummaryKeys();
    if (!keys) return null;

    const allOps = this.cahierService.operations();
    const filteredOps = allOps.filter(o => {
      if (!o || o.isDraft) return false;
      if (!o.date || typeof o.date !== 'string') return false;
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
      return key === keys.month && o.site === keys.site;
    });

    if (filteredOps.length === 0) {
      return null;
    }

    return {
      month: keys.month,
      site: keys.site,
      type: '',
      count: filteredOps.length,
      operations: filteredOps
    };
  });

  readonly activeDraftId = signal<string | null>(null);
  readonly globalDnPrefix = signal<string>('DN');
  readonly isEditingRegistered = signal<boolean>(false);

  // Available options
  readonly sites = ['SCMC', 'TUSCANI', 'AFISA', 'AUTRE'];
  readonly operationTypes = ['Chargement', 'Déchargement', 'Surmontage', 'Transfert', 'Son', 'Chargement des wagons'] as const;
  readonly filteredOperationTypes = computed<string[]>(() => {
    const site = this.formValue().site;
    if (site === 'TUSCANI') {
      return ['Chargement Camions'];
    }
    if (site === 'AUTRE') {
      return ['Chargement des wagons', 'Reconditionnement', 'Nettoyage'];
    }
    return ['Chargement', 'Déchargement', 'Surmontage', 'Transfert', 'Son'];
  });
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

    const currentType = this.operationForm.controls.type.value || '';
    const currentProduct = this.operationForm.controls.produit.value || '';
    const isDnRequired = currentType === 'Chargement' || currentType === 'Chargement Camions' || ((currentType === 'Chargement des wagons' || currentType === 'Chargement wagons') && currentProduct === 'Blé');
    const isProduitRequired = currentType !== 'Chargement Camions';

    const group = new FormGroup({
      date: new FormControl<string>(date || this.operationForm.controls.date.value || '', { validators: [Validators.required], nonNullable: true }),
      dnPrefix: new FormControl<string>(prefix, { validators: (isDnRequired && currentType !== 'Chargement Camions') ? [Validators.required] : [], nonNullable: true }),
      dnNumber: new FormControl<string>(num, { validators: isDnRequired ? [Validators.required] : [], nonNullable: true }),
      dn: new FormControl<string>(dn || `${prefix} ${num}`.toUpperCase().trim(), { validators: isDnRequired ? [Validators.required] : [], nonNullable: true }),
      produit: new FormControl<string>(produit, { validators: isProduitRequired ? [Validators.required] : [], nonNullable: true }),
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

      // Dropdown selection (dnPrefix + dnNumber) should only apply to 'Chargement' or 'Chargement des wagons' type
      if (this.operationForm.value.type === 'Chargement' || this.operationForm.value.type === 'Chargement Camions' || this.operationForm.value.type === 'Chargement des wagons' || this.operationForm.value.type === 'Chargement wagons') {
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
    const defaultProduct = this.operationForm.controls.produit.value || '';
    const group = this.createItemFormGroup(opDate, '', defaultProduct);
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
            raw.items.forEach((item: Partial<OperationItem>) => {
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
      items: (val.items as Partial<OperationItem>[] || []).map(item => ({
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
    return val.items.reduce((sum: number, item: Partial<OperationItem>) => sum + (Number(item?.montant) || 0), 0);
  });

  // Calculate instant total of quantities (Tonnage / sacs)
  readonly totalQuantite = computed<number>(() => {
    const val = this.formValue();
    if (!val.items || !Array.isArray(val.items)) return 0;
    return val.items.reduce((sum: number, item: Partial<OperationItem>) => sum + (Number(item?.qte) || 0), 0);
  });

  readonly tableColspan = computed<number>(() => {
    const val = this.formValue();
    if (val.type === 'Chargement des wagons' || val.type === 'Chargement wagons') {
      return val.produit === 'Blé' ? 6 : 5;
    }
    if (val.type === 'Chargement Camions') {
      return 6;
    }
    return val.type === 'Chargement' ? 7 : 6;
  });

  readonly totalColspan = computed<number>(() => {
    const val = this.formValue();
    if (val.type === 'Chargement des wagons' || val.type === 'Chargement wagons') {
      return val.produit === 'Blé' ? 4 : 3;
    }
    if (val.type === 'Chargement Camions') {
      return 4;
    }
    return val.type === 'Chargement' ? 5 : 4;
  });

  getOperationTotal(op: Operation): number {
    if (!op || !op.items || !Array.isArray(op.items)) return 0;
    return op.items.reduce((sum: number, item: OperationItem) => sum + (Number(item?.montant) || 0), 0);
  }

  // Opens the creation page view
  openNewOperationModal() {
    this.isEditingRegistered.set(false);
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
    this.isEditingRegistered.set(false);
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

  // Opens form from an existing registered operation
  editOperation(op: Operation) {
    this.isEditingRegistered.set(true);
    this.itemsFormArray.clear();
    this.activeDraftId.set(op.id);
    
    this.operationForm.patchValue({
      site: op.site,
      type: op.type,
      date: op.date,
      heure: op.heure,
      quantite: op.quantite !== undefined ? op.quantite : null,
      produit: op.produit || '',
      destination: op.destination || '',
      sonLevel: op.sonLevel || 'Moyen',
      frequence: op.frequence || 'Basse',
      details: op.details || ''
    });

    if (op.items && op.items.length > 0) {
      op.items.forEach(item => {
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
    if (this.isSaving()) return;
    this.isSaving.set(true);
    try {
      const val = this.operationForm.getRawValue();
      let rawItems = (val.items || []) as {
        date?: string;
        dnPrefix?: string;
        dnNumber?: string;
        dn?: string;
        produit?: string;
        qte?: number | null;
        pu?: number | null;
        montant?: number | null;
      }[];

      // Sort items if they are "Chargement" at "AFISA" or "SCMC"
      if ((val.site === 'AFISA' || val.site === 'SCMC') && val.type === 'Chargement') {
        rawItems = [...rawItems].sort((a, b) => {
          const aNum = (a.dnNumber || '').trim();
          const bNum = (b.dnNumber || '').trim();
          return aNum.localeCompare(bNum, undefined, { numeric: true, sensitivity: 'base' });
        });
      }

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
        items: rawItems.map(item => ({
          date: item.date || val.date || '',
          dn: item.dn || `${item.dnPrefix || 'DN'} ${item.dnNumber || ''}`.toUpperCase().trim(),
          produit: item.produit || '',
          qte: item.qte !== null ? Number(item.qte) : 0,
          pu: item.pu !== null ? Number(item.pu) : 0,
          montant: item.montant !== null ? Number(item.montant) : 0
        }))
      };

      await this.cahierService.saveDraft(draftData);
      this.isCreationPageOpen.set(false);
    } finally {
      this.isSaving.set(false);
    }
  }

  async closeModal() {
    if (this.isSaving()) return;
    if (this.isEditingRegistered()) {
      if (this.operationForm.dirty) {
        // Si l'utilisateur a fait des modifications sur le formulaire/tableau d'une opération déjà enregistrée 
        // mais qu'il ferme sans enregistrer les modifications, le tableau repart automatiquement en brouillon.
        await this.saveAsDraft();
        return;
      }
      this.isCreationPageOpen.set(false);
      return;
    }

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
    const currentType = this.operationForm.controls.type.value;
    const allowedTypes = this.filteredOperationTypes();
    if (currentType && !allowedTypes.includes(currentType)) {
      this.operationForm.patchValue({ type: '' });
    }
    this.goToStep2();
  }

  selectType(typeOption: string) {
    this.operationForm.patchValue({ type: typeOption });
    if (typeOption !== 'Chargement des wagons' && typeOption !== 'Chargement wagons') {
      this.goToStep3();
    }
  }

  selectWagonProduct(product: string) {
    this.operationForm.patchValue({ produit: product });
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
        const defaultProduct = this.operationForm.controls.produit.value || '';
        this.itemsFormArray.push(this.createItemFormGroup(opDate, '', defaultProduct));
      }

      this.currentStep.set(3);
    }
  }

  // Submits the newly created operation
  async onSubmit() {
    if (this.isSaving()) return;
    if (this.operationForm.invalid) {
      this.operationForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    try {
      const val = this.operationForm.getRawValue();
      let rawItems = (val.items || []) as {
        date?: string;
        dnPrefix?: string;
        dnNumber?: string;
        dn?: string;
        produit?: string;
        qte?: number | null;
        pu?: number | null;
        montant?: number | null;
      }[];

      // Sort items if they are "Chargement" at "AFISA" or "SCMC"
      if ((val.site === 'AFISA' || val.site === 'SCMC') && val.type === 'Chargement') {
        rawItems = [...rawItems].sort((a, b) => {
          const aNum = (a.dnNumber || '').trim();
          const bNum = (b.dnNumber || '').trim();
          return aNum.localeCompare(bNum, undefined, { numeric: true, sensitivity: 'base' });
        });
      }

      const opData: Omit<Operation, 'id' | 'collaborateur'> & { id?: string } = {
        id: this.activeDraftId() || undefined,
        site: val.site,
        type: val.type as Operation['type'],
        date: val.date,
        heure: val.heure,
        details: val.details || undefined,
        items: rawItems.map(item => ({
          date: item.date || '',
          dn: item.dn || `${item.dnPrefix || 'DN'} ${item.dnNumber || ''}`.toUpperCase().trim(),
          produit: item.produit || '',
          qte: Number(item.qte) || 0,
          pu: Number(item.pu) || 0,
          montant: Number(item.montant) || 0
        }))
      };

      await this.cahierService.addOperation(opData);
      this.isCreationPageOpen.set(false); // Close directly, bypassing dirty closeModal check
    } finally {
      this.isSaving.set(false);
    }
  }

  // Deletes an operation with local confirmation
  deleteOp(id: string) {
    this.operationToDelete.set(id);
  }

  // Confirms the deletion of an operation
  async confirmDelete() {
    const id = this.operationToDelete();
    if (id) {
      this.isSaving.set(true);
      try {
        await this.cahierService.deleteOperation(id);
      } finally {
        this.isSaving.set(false);
        this.operationToDelete.set(null);
      }
    }
  }

  // Cancels delete operation
  cancelDelete() {
    this.operationToDelete.set(null);
  }

  // Exports an operation to PDF format using the PDF export service
  exportToPdf(op: Operation) {
    this.pdfService.exportOperationToPdf(op);
  }

  // Set detailed summary view
  showDetail(summary: MonthlySummary) {
    this.selectedSummaryKeys.set({
      month: summary.month,
      site: summary.site
    });
  }

  // Clear detailed summary and return to main monthly table
  backToMonthly() {
    this.selectedSummaryKeys.set(null);
  }

  // Groups operations by type for the detailed view, sorted by chronological order of their first entry (saisie)
  readonly detailedTypeGroups = computed(() => {
    const summary = this.selectedSummary();
    if (!summary) return [];

    const ops = [...summary.operations];

    // Helper to get sortable ISO time string from operation date and time
    const getOpTime = (op: Operation) => {
      const date = op.date || '';
      const heure = op.heure || '00:00';
      return `${date}T${heure}`;
    };

    // Group by operation type and product
    const groups: Record<string, Operation[]> = {};
    ops.forEach(op => {
      const type = op.type;
      const product = op.produit || '';
      const key = product ? `${type}|${product}` : type;
      
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(op);
    });

    // Sort groups based on the oldest (earliest) operation date/time in each group
    const sortedKeys = Object.keys(groups).sort((keyA, keyB) => {
      const opsA = groups[keyA];
      const opsB = groups[keyB];

      const earliestA = opsA.reduce((earliest, curr) => {
        return getOpTime(curr) < getOpTime(earliest) ? curr : earliest;
      }, opsA[0]);

      const earliestB = opsB.reduce((earliest, curr) => {
        return getOpTime(curr) < getOpTime(earliest) ? curr : earliest;
      }, opsB[0]);

      return getOpTime(earliestA).localeCompare(getOpTime(earliestB));
    });

    return sortedKeys.map(key => {
      // Sort operations inside this group chronologically descending (newest first for readability)
      const sortedOps = groups[key].sort((a, b) => {
        return getOpTime(b).localeCompare(getOpTime(a));
      });

      // The key is "Type|Product" or just "Type"
      const [type, product] = key.includes('|') ? key.split('|') : [key, ''];

      return {
        type,
        product,
        ops: sortedOps
      };
    });
  });

  getGroupTotalQte(ops: Operation[]): number {
    let total = 0;
    ops.forEach(op => {
      if (op && op.items && Array.isArray(op.items)) {
        op.items.forEach(item => {
          total += Number(item.qte) || 0;
        });
      }
    });
    return total;
  }

  getGroupTotalMontant(ops: Operation[]): number {
    let total = 0;
    ops.forEach(op => {
      if (op && op.items && Array.isArray(op.items)) {
        op.items.forEach(item => {
          total += Number(item.montant) || 0;
        });
      }
    });
    return total;
  }

}

