import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { Operation, MonthlySummary } from '../../shared/models/cahier.model';

@Injectable({
  providedIn: 'root'
})
export class ExcelExportService {

  /**
   * Exporte une opération individuelle sous forme de fichier XLSX professionnel.
   */
  exportOperationToExcel(op: Operation): void {
    const wsData: (string | number | undefined | null)[][] = [
      ['PORTSYNC LOGISTICS - RAPPORT D\'OPÉRATION'],
      [],
      ['INFORMATIONS GÉNÉRALES'],
      ['Référence ID', op.id],
      ['Site', op.site],
      ['Type d\'Opération', op.type],
      ['Date', op.date],
      ['Heure', op.heure],
      ['Niveau Sonore', op.sonLevel || 'N/A'],
      ['Fréquence', op.frequence || 'N/A'],
      ['Détails / Notes', op.details || 'Aucun détail'],
      [],
      ['DÉTAILS DES PRODUITS & QUANTITÉS'],
      ['Date', 'N° DN / Camion', 'Produit', 'Quantité', 'Prix Unitaire (FCFA)', 'Montant (FCFA)']
    ];

    if (op.items && op.items.length > 0) {
      op.items.forEach(item => {
        wsData.push([
          item.date,
          item.dn,
          item.produit,
          item.qte,
          item.pu,
          item.montant
        ]);
      });

      // Calcul des totaux de l'opération
      const totalQte = op.items.reduce((sum, item) => sum + (item.qte || 0), 0);
      const totalMontant = op.items.reduce((sum, item) => sum + (item.montant || 0), 0);
      wsData.push([]);
      wsData.push(['TOTAL', '', '', totalQte, '', totalMontant]);
    } else {
      // Cas de repli si pas de sous-éléments (utilise les champs de l'opération parente)
      wsData.push([
        op.date,
        op.destination || 'N/A',
        op.produit || 'N/A',
        op.quantite || 0,
        0,
        0
      ]);
      wsData.push([]);
      wsData.push(['TOTAL', '', '', op.quantite || 0, '', 0]);
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Ajustement de la largeur des colonnes
    ws['!cols'] = [
      { wch: 15 }, // Date / Propriété
      { wch: 20 }, // N° DN / Valeur
      { wch: 25 }, // Produit
      { wch: 15 }, // Quantité
      { wch: 20 }, // Prix Unitaire
      { wch: 20 }  // Montant
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Opération');
    XLSX.writeFile(wb, `Operation_${op.id}_${op.date}.xlsx`);
  }

  /**
   * Exporte un résumé mensuel complet sous forme de tableau plat au format XLSX.
   */
  exportMonthlySummaryToExcel(summary: MonthlySummary): void {
    const wsData: (string | number | undefined | null)[][] = [
      ['PORTSYNC LOGISTICS - RAPPORT MENSUEL DES MOUVEMENTS'],
      [`Période : ${summary.month} | Site : ${summary.site}`],
      [],
      [
        'ID Opération',
        'Type d\'Opération',
        'Date Opération',
        'Heure',
        'N° DN / Camion',
        'Produit',
        'Quantité',
        'Prix Unitaire (FCFA)',
        'Montant (FCFA)',
        'Niveau Son',
        'Fréquence',
        'Détails / Notes'
      ]
    ];

    let totalQteGlobal = 0;
    let totalMontantGlobal = 0;

    summary.operations.forEach(op => {
      if (op.items && op.items.length > 0) {
        op.items.forEach(item => {
          wsData.push([
            op.id,
            op.type,
            op.date,
            op.heure,
            item.dn,
            item.produit,
            item.qte,
            item.pu,
            item.montant,
            op.sonLevel || 'N/A',
            op.frequence || 'N/A',
            op.details || ''
          ]);
          totalQteGlobal += (item.qte || 0);
          totalMontantGlobal += (item.montant || 0);
        });
      } else {
        wsData.push([
          op.id,
          op.type,
          op.date,
          op.heure,
          op.destination || 'N/A',
          op.produit || 'N/A',
          op.quantite || 0,
          0,
          0,
          op.sonLevel || 'N/A',
          op.frequence || 'N/A',
          op.details || ''
        ]);
        totalQteGlobal += (op.quantite || 0);
      }
    });

    // Ajouter la ligne de totaux globaux
    wsData.push([]);
    wsData.push([
      'TOTAL GLOBAL',
      '',
      '',
      '',
      '',
      '',
      totalQteGlobal,
      '',
      totalMontantGlobal,
      '',
      '',
      ''
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Ajustement de la largeur des colonnes
    ws['!cols'] = [
      { wch: 15 }, // ID Opération
      { wch: 22 }, // Type d'Opération
      { wch: 15 }, // Date Opération
      { wch: 10 }, // Heure
      { wch: 20 }, // N° DN / Camion
      { wch: 25 }, // Produit
      { wch: 15 }, // Quantité
      { wch: 18 }, // Prix Unitaire
      { wch: 20 }, // Montant
      { wch: 12 }, // Niveau Son
      { wch: 12 }, // Fréquence
      { wch: 35 }  // Détails / Notes
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Rapport Mensuel');
    
    // Nettoyage du nom du fichier
    const safeMonthName = summary.month.replace(/\s+/g, '_');
    const safeSiteName = summary.site.replace(/\s+/g, '_');
    XLSX.writeFile(wb, `Rapport_Mensuel_${safeSiteName}_${safeMonthName}.xlsx`);
  }
}
