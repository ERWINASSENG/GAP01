import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Operation } from '../../shared/models/cahier.model';

interface JspdfExtended {
  lastAutoTable?: {
    finalY: number;
  };
  internal: {
    getNumberOfPages: () => number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class PdfExportService {

  /**
   * Génère et télécharge un rapport PDF administratif hautement soigné pour une opération.
   */
  exportOperationToPdf(op: Operation): void {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const primaryColor = [15, 23, 42];    // Slate 900
    const secondaryColor = [71, 85, 105]; // Slate 600
    const accentColor = [13, 148, 136];   // Teal 600
    const lightBg = [248, 250, 252];      // Slate 50
    const borderGray = [226, 232, 240];   // Slate 200

    // --- EN-TÊTE ADMINISTRATIF ---
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 8, 'F'); // Bandeau décoratif supérieur

    // Logo / Titre Principal de l'Entité
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('PORTSYNC LOGISTICS', 14, 22);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text('RÉPUBLIQUE DU CAMEROUN', 140, 18);
    doc.text('Paix - Travail - Patrie', 148, 22);
    doc.text('Direction des Opérations Portuaires', 130, 26);

    // Ligne de séparation
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.setLineWidth(0.5);
    doc.line(14, 32, 196, 32);

    // --- TITRE DU DOCUMENT ---
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    const documentTitle = op.type === 'Chargement' || op.type === 'Chargement Camions' || op.type === 'Chargement des wagons' || op.type === 'Chargement wagons'
      ? 'BON DE CHARGEMENT ADMINISTRATIF'
      : `FICHE DE MOUVEMENT : ${op.type.toUpperCase()}`;
    doc.text(documentTitle, 14, 42);

    // Numéro de référence unique
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    const refNum = `REF-${op.id.substring(0, 8).toUpperCase()}`;
    doc.text(refNum, 14, 47);

    // --- CADRE INFORMATIONS GÉNÉRALES ---
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.rect(14, 53, 182, 36, 'F');
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.rect(14, 53, 182, 36, 'S');

    // Libellés & Valeurs (Grille de métadonnées)
    doc.setFontSize(9.5);
    
    // Colonne 1
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text('Site d\'Opération :', 18, 60);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(op.site || '-', 55, 60);

    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text('Type de Mouvement :', 18, 68);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(op.type || '-', 55, 68);

    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text('Collaborateur en Charge :', 18, 76);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(op.collaborateur || 'Non spécifié', 55, 76);

    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text('Statut du document :', 18, 84);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text('ENREGISTRÉ', 55, 84);

    // Colonne 2
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text('Date de saisie :', 115, 60);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(this.formatFrenchDate(op.date), 145, 60);

    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text('Heure d\'Enregistrement :', 115, 68);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(op.heure || '-', 158, 68);

    // Champs spécifiques selon le type
    if (op.type !== 'Chargement' && op.type !== 'Chargement Camions' && op.type !== 'Chargement des wagons' && op.type !== 'Chargement wagons') {
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text('Produit concerné :', 115, 76);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(op.produit || '-', 145, 76);

      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text('Quantité totale :', 115, 84);
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(op.quantite !== undefined ? `${op.quantite.toLocaleString('fr-FR')}` : '-', 145, 84);
    } else {
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text('Mode d\'Opération :', 115, 76);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text((op.type === 'Chargement des wagons' || op.type === 'Chargement wagons') ? 'Ferroviaire (Wagons)' : 'Routier / Interne', 148, 76);
    }

    // --- CONTENU DU MOUVEMENT ---
    let finalY = 94;

    if (op.type === 'Chargement' || op.type === 'Chargement Camions' || op.type === 'Chargement des wagons' || op.type === 'Chargement wagons') {
      // Affichage sous forme de Tableau complet (jsPDF AutoTable)
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('LIGNES DE CHARGEMENT DÉTAILLÉES', 14, 96);

      let headers = [['Date', 'DN / LTI / ISTI', 'Produit', 'Qte (t)', 'PU (FCFA)', 'Montant (FCFA)']];
      let colStyles: Record<number, { cellWidth: number, halign?: 'left' | 'right' | 'center' }> = {
        0: { cellWidth: 25 },
        1: { cellWidth: 35 },
        2: { cellWidth: 40, halign: 'left' },
        3: { cellWidth: 22, halign: 'right' },
        4: { cellWidth: 25, halign: 'right' },
        5: { cellWidth: 35, halign: 'right' }
      };

      if (op.type === 'Chargement Camions') {
        headers = [['Date', 'Camions', 'Tonnage (t)', 'PU (FCFA)', 'Montant (FCFA)']];
        colStyles = {
          0: { cellWidth: 30 },
          1: { cellWidth: 45 },
          2: { cellWidth: 30, halign: 'right' },
          3: { cellWidth: 35, halign: 'right' },
          4: { cellWidth: 42, halign: 'right' }
        };
      }

      const data = (op.items || []).map(item => {
        if (op.type === 'Chargement Camions') {
          return [
            this.formatFrenchDate(item.date),
            item.dn || '-',
            item.qte.toLocaleString('fr-FR'),
            item.pu.toLocaleString('fr-FR'),
            item.montant.toLocaleString('fr-FR')
          ];
        }
        return [
          this.formatFrenchDate(item.date),
          item.dn || '-',
          item.produit || '-',
          item.qte.toLocaleString('fr-FR'),
          item.pu.toLocaleString('fr-FR'),
          item.montant.toLocaleString('fr-FR')
        ];
      });

      const totalQte = (op.items || []).reduce((acc, curr) => acc + curr.qte, 0);
      const totalMontant = (op.items || []).reduce((acc, curr) => acc + curr.montant, 0);

      // Ligne de total
      if (op.type === 'Chargement Camions') {
        data.push([
          'TOTAL',
          '',
          totalQte.toLocaleString('fr-FR'),
          '',
          totalMontant.toLocaleString('fr-FR')
        ]);
      } else {
        data.push([
          'TOTAL',
          '',
          '',
          totalQte.toLocaleString('fr-FR'),
          '',
          totalMontant.toLocaleString('fr-FR')
        ]);
      }

      autoTable(doc, {
        startY: 100,
        head: headers,
        body: data,
        theme: 'striped',
        headStyles: {
          fillColor: primaryColor as [number, number, number],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 9
        },
        bodyStyles: {
          fontSize: 8.5,
          textColor: [51, 65, 85],
          halign: 'center'
        },
        columnStyles: colStyles,
        didParseCell: (cellData) => {
          // Mettre en gras la dernière ligne de total
          if (cellData.row.index === data.length - 1) {
            cellData.cell.styles.fontStyle = 'bold';
            cellData.cell.styles.textColor = [15, 23, 42];
            cellData.cell.styles.fillColor = [241, 245, 249];
          }
        },
        margin: { left: 14, right: 14 }
      });

      finalY = (doc as unknown as JspdfExtended).lastAutoTable?.finalY || 120;
      finalY += 15;
    } else {
      // Affichage simple des détails pour les autres mouvements
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('DÉTAILS COMPLÉMENTAIRES DE L\'OPÉRATION', 14, 96);

      // Détails de l'opération
      doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
      doc.rect(14, 100, 182, 35, 'F');
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      doc.rect(14, 100, 182, 35, 'S');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text('Détails & Notes :', 18, 107);
      
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      const splitDetails = doc.splitTextToSize(op.details || 'Aucune description ou note supplémentaire pour cette opération.', 174);
      doc.text(splitDetails, 18, 113);

      if (op.type === 'Transfert') {
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.text('Destination du transfert :', 18, 130);
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.text(op.destination || 'Non définie', 65, 130);
      } else if (op.type === 'Son') {
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.text(`Niveau sonore : ${op.sonLevel || 'Moyen'}`, 18, 130);
        doc.text(`Fréquence : ${op.frequence || 'Basse'}`, 110, 130);
      }

      finalY = 150;
    }

    // S'assurer qu'on ne dépasse pas la page pour la signature
    if (finalY > 230) {
      doc.addPage();
      finalY = 30;
    }

    // --- BLOCS DE SIGNATURE ---
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.setLineWidth(0.3);
    doc.line(14, finalY, 196, finalY);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text('Le Responsable d\'Opération', 30, finalY + 10);
    doc.text('Le Chef de Poste / Validateur', 130, finalY + 10);

    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text('(Signature précédée de la mention "Lu et approuvé")', 22, finalY + 36);
    doc.text('(Visa officiel et signature)', 140, finalY + 36);

    // --- PIED DE PAGE ---
    const pageCount = (doc as unknown as JspdfExtended).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      // Date et heure d'exportation
      const exportDate = new Date().toLocaleString('fr-FR');
      doc.text(`Document généré le ${exportDate} via PortSync Logistics App.`, 14, 287);
      doc.text(`Page ${i} sur ${pageCount}`, 180, 287);
    }

    // Nom du fichier personnalisé
    const safeDate = op.date.replace(/-/g, '');
    const filename = `PortSync_${op.type}_${op.site}_${safeDate}.pdf`.replace(/\s+/g, '_');
    doc.save(filename);
  }

  /**
   * Formate une date YYYY-MM-DD en DD/MM/YYYY
   */
  private formatFrenchDate(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  }
}
