import { Injectable } from '@angular/core';
import { 
  Document, 
  Paragraph, 
  Table, 
  TableCell, 
  TableRow, 
  TextRun, 
  WidthType, 
  AlignmentType, 
  BorderStyle, 
  VerticalAlign, 
  Packer, 
  VerticalMergeType,
  Footer
} from 'docx';
import { Operation, MonthlySummary } from '../../shared/models/cahier.model';

interface MonthlyItemWithMeta {
  originalDate: string;
  originalTime: string;
  dateStr: string;
  dn: string;
  produit: string;
  qte: number;
  pu: number;
  montant: number;
  mergeDate?: 'restart' | 'continue' | 'none';
}

@Injectable({
  providedIn: 'root'
})
export class DocxExportService {

  /**
   * Exporte une opération individuelle au format DOCX professionnel.
   */
  exportOperationToDocx(op: Operation): void {
    const safeDate = op.date.replace(/-/g, '');
    const filename = `PortSync_${op.type}_${op.site}_${safeDate}.docx`.replace(/\s+/g, '_');

    const primaryColor = "0F172A";    // Slate 900
    const secondaryColor = "475569";  // Slate 600
    const accentColor = "0D9488";     // Teal 600
    const lightBg = "F8FAFC";         // Slate 50

    // En-tête administratif
    const headerParagraphs = [
      new Paragraph({
        children: [
          new TextRun({
            text: "PORTSYNC LOGISTICS",
            bold: true,
            size: 28, // 14pt
            color: primaryColor,
            font: "Arial"
          })
        ],
        alignment: AlignmentType.LEFT,
        spacing: { before: 200, after: 50 }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "RÉPUBLIQUE DU CAMEROUN\n",
            bold: true,
            size: 18, // 9pt
            color: secondaryColor,
            font: "Arial"
          }),
          new TextRun({
            text: "Paix - Travail - Patrie\n",
            italics: true,
            size: 16, // 8pt
            color: secondaryColor,
            font: "Arial"
          }),
          new TextRun({
            text: "Direction des Opérations Portuaires",
            size: 16,
            color: secondaryColor,
            font: "Arial"
          })
        ],
        alignment: AlignmentType.RIGHT,
        spacing: { before: -400, after: 200 } // Positionné à droite via alignment, gère le décalage
      })
    ];

    // Titre de la fiche
    const titleText = op.type === 'Chargement' || op.type === 'Chargement Camions' || op.type === 'Chargement des wagons' || op.type === 'Chargement wagons'
      ? 'BON DE CHARGEMENT ADMINISTRATIF'
      : `FICHE DE MOUVEMENT : ${op.type.toUpperCase()}`;

    const refNum = `REF-${op.id.substring(0, 8).toUpperCase()}`;

    const titleParagraphs = [
      new Paragraph({
        children: [
          new TextRun({
            text: titleText,
            bold: true,
            size: 24, // 12pt
            color: primaryColor,
            font: "Arial"
          })
        ],
        spacing: { before: 300, after: 50 }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: refNum,
            bold: true,
            size: 18,
            color: accentColor,
            font: "Arial"
          })
        ],
        spacing: { before: 0, after: 250 }
      })
    ];

    // Tableau d'informations générales
    const infoTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            this.createMetadataCell("Site d'Opération :", op.site || '-', secondaryColor, primaryColor),
            this.createMetadataCell("Date de Saisie :", this.formatFrenchDate(op.date), secondaryColor, primaryColor)
          ]
        }),
        new TableRow({
          children: [
            this.createMetadataCell("Type de Mouvement :", op.type || '-', secondaryColor, primaryColor),
            this.createMetadataCell("Heure d'Enregistrement :", op.heure || '-', secondaryColor, primaryColor)
          ]
        }),
        new TableRow({
          children: [
            this.createMetadataCell("Collaborateur en Charge :", op.collaborateur || 'Non spécifié', secondaryColor, primaryColor),
            this.createMetadataCell("Statut du Document :", "ENREGISTRÉ", secondaryColor, accentColor, true)
          ]
        })
      ]
    });

    const bodyChildren: (Paragraph | Table)[] = [
      ...headerParagraphs,
      ...titleParagraphs,
      infoTable,
      new Paragraph({ text: "", spacing: { before: 200, after: 200 } }) // Espacement
    ];

    // Si opération de chargement avec tableau de détails
    if (op.type === 'Chargement' || op.type === 'Chargement Camions' || op.type === 'Chargement des wagons' || op.type === 'Chargement wagons') {
      bodyChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "LIGNES DE CHARGEMENT DÉTAILLÉES",
              bold: true,
              size: 20,
              color: primaryColor,
              font: "Arial"
            })
          ],
          spacing: { before: 200, after: 150 }
        })
      );

      // Création du tableau de données
      const table = this.createTableForSingleOperation(op, primaryColor);
      bodyChildren.push(table);
    } else {
      // Autres types d'opérations (Détails complémentaires)
      bodyChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "DÉTAILS COMPLÉMENTAIRES DE L'OPÉRATION",
              bold: true,
              size: 20,
              color: primaryColor,
              font: "Arial"
            })
          ],
          spacing: { before: 200, after: 150 }
        })
      );

      const noteTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Détails & Notes :\n", bold: true, color: secondaryColor, size: 18, font: "Arial" }),
                      new TextRun({ text: op.details || "Aucune description ou note supplémentaire pour cette opération.", size: 18, font: "Arial" })
                    ],
                    spacing: { before: 100, after: 100 }
                  }),
                  ...(op.type === 'Transfert' ? [
                    new Paragraph({
                      children: [
                        new TextRun({ text: "Destination du transfert : ", bold: true, color: secondaryColor, size: 18, font: "Arial" }),
                        new TextRun({ text: op.destination || "Non définie", bold: true, color: accentColor, size: 18, font: "Arial" })
                      ],
                      spacing: { before: 100, after: 100 }
                    })
                  ] : []),
                  ...(op.type === 'Son' ? [
                    new Paragraph({
                      children: [
                        new TextRun({ text: `Niveau sonore : ${op.sonLevel || 'Moyen'}    |    Fréquence : ${op.frequence || 'Basse'}`, bold: true, color: secondaryColor, size: 18, font: "Arial" })
                      ],
                      spacing: { before: 100, after: 100 }
                    })
                  ] : [])
                ],
                shading: { fill: lightBg },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                  left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                  right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" }
                }
              })
            ]
          })
        ]
      });

      bodyChildren.push(noteTable);
    }



    // Footer de page
    const exportDate = new Date().toLocaleString('fr-FR');
    const footerParagraph = new Paragraph({
      children: [
        new TextRun({
          text: `Document généré le ${exportDate} via PortSync Logistics App.`,
          size: 15,
          color: "94A3B8",
          font: "Arial"
        })
      ],
      alignment: AlignmentType.LEFT
    });

    const doc = new Document({
      sections: [{
        children: bodyChildren,
        footers: {
          default: new Footer({
            children: [footerParagraph]
          })
        }
      }]
    });

    this.downloadBlob(doc, filename);
  }

  /**
   * Exporte un résumé mensuel d'opérations groupées au format DOCX, 
   * avec fusions verticales de dates et présentation tabulaire comme demandé.
   */
  exportMonthlySummaryToDocx(summary: MonthlySummary): void {
    const filename = `Rapport_${summary.month}_${summary.site}.docx`.replace(/\s+/g, '_');

    const primaryColor = "0F172A";    // Slate 900
    const accentColor = "4F46E5";     // Indigo 600

    const bodyChildren: (Paragraph | Table)[] = [];



    // Obtenir les groupes d'opérations par type (similaire au computed de cahier.component)
    const groups = this.getGroupedOperations(summary);

    if (groups.length === 0) {
      bodyChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "Aucun mouvement enregistré pour cette période.",
              italics: true,
              size: 18,
              font: "Arial"
            })
          ],
          spacing: { before: 200, after: 200 }
        })
      );
    }

    groups.forEach((group, gIdx) => {
      const isWagon = group.type.toLowerCase().includes('wagon');
      const showDn = group.type === 'Chargement' && (summary.site === 'AFISA' || summary.site === 'SCMC');

      // Titre de la section de table
      let tableTitle = '';
      if (group.type === 'Chargement des wagons' || group.type === 'Chargement wagons') {
        tableTitle = `CHARGEMENT WAGONS ${ (group.product || '').toUpperCase() }`;
      } else {
        tableTitle = `${ group.type.toUpperCase() }`;
      }
      if (summary.site !== 'AUTRE') {
        tableTitle += ` ${summary.site.toUpperCase()}`;
      }

      bodyChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: tableTitle,
              bold: true,
              size: 20,
              color: primaryColor,
              font: "Arial"
            })
          ],
          spacing: { before: gIdx === 0 ? 100 : 400, after: 150 }
        })
      );

      // Aplatir et trier les éléments chronologiquement pour le tableau
      const itemsWithMeta: MonthlyItemWithMeta[] = group.ops.flatMap(op => 
        (op.items || []).map(item => ({
          originalDate: item.date,
          originalTime: op.heure || '00:00',
          dateStr: this.formatFrenchDate(item.date),
          dn: item.dn || '-',
          produit: item.produit || op.produit || '-',
          qte: item.qte || 0,
          pu: item.pu || 0,
          montant: item.montant || 0
        }))
      );

      // Tri par date/heure croissante
      itemsWithMeta.sort((a, b) => {
        const dateTimeA = `${a.originalDate}T${a.originalTime}`;
        const dateTimeB = `${b.originalDate}T${b.originalTime}`;
        return dateTimeA.localeCompare(dateTimeB);
      });

      // Calcul des fusions de dates consécutives
      for (let i = 0; i < itemsWithMeta.length; i++) {
        const current = itemsWithMeta[i];
        if (i === 0) {
          const hasNextSame = itemsWithMeta.length > 1 && itemsWithMeta[1].dateStr === current.dateStr;
          current.mergeDate = hasNextSame ? 'restart' : 'none';
        } else {
          const prev = itemsWithMeta[i - 1];
          if (current.dateStr === prev.dateStr) {
            current.mergeDate = 'continue';
          } else {
            const hasNextSame = i < itemsWithMeta.length - 1 && itemsWithMeta[i + 1].dateStr === current.dateStr;
            current.mergeDate = hasNextSame ? 'restart' : 'none';
          }
        }
      }

      // Définir les colonnes selon le type d'opération
      let headers: string[] = [];
      let widths: number[] = []; // En pourcentage

      if (group.type === 'Chargement Camions') {
        headers = ['Date', 'Camions', 'Tonnage (t)', 'PU (FCFA)', 'Montant (FCFA)'];
        widths = [20, 25, 18, 17, 20];
      } else if (showDn || isWagon) {
        const dnLabel = isWagon ? 'N° Wagon' : 'DN / LTI / ISTI';
        headers = ['Date', dnLabel, 'Produits', 'QTE', 'PU', 'Montant'];
        widths = [18, 20, 24, 12, 11, 15];
      } else {
        headers = ['Date', 'Produits', 'QTE', 'PU', 'Montant'];
        widths = [20, 32, 16, 14, 18];
      }

      // Création des lignes de tableau
      const tableRows: TableRow[] = [];

      // Row 1: Header de colonnes
      tableRows.push(
        new TableRow({
          children: headers.map((h, hIdx) => this.createCell(h, {
            bold: true,
            size: 18,
            color: "FFFFFF",
            fill: primaryColor,
            widthPercent: widths[hIdx]
          }))
        })
      );

      // Rows: Éléments de données
      itemsWithMeta.forEach(item => {
        const rowCells: TableCell[] = [];

        // 1. DATE Cell
        const mDate = item.mergeDate || 'none';
        if (mDate === 'restart') {
          rowCells.push(this.createCell(item.dateStr, {
            verticalMerge: VerticalMergeType.RESTART,
            bold: true,
            size: 17,
            widthPercent: widths[0]
          }));
        } else if (mDate === 'continue') {
          rowCells.push(this.createCell("", {
            verticalMerge: VerticalMergeType.CONTINUE,
            widthPercent: widths[0]
          }));
        } else {
          rowCells.push(this.createCell(item.dateStr, {
            bold: true,
            size: 17,
            widthPercent: widths[0]
          }));
        }

        // 2. DN / Wagon / Camion (si applicable)
        let dataIndex = 1;
        if (showDn || group.type === 'Chargement Camions' || isWagon) {
          rowCells.push(this.createCell(item.dn, {
            bold: true,
            size: 17,
            widthPercent: widths[dataIndex++]
          }));
        }

        // 3. Produit (si applicable)
        if (group.type !== 'Chargement Camions' && !isWagon) {
          rowCells.push(this.createCell(item.produit, {
            align: AlignmentType.LEFT,
            size: 17,
            widthPercent: widths[dataIndex++]
          }));
        }

        // 4. Qte / Tonnage
        rowCells.push(this.createCell(item.qte.toLocaleString('fr-FR'), {
          size: 17,
          widthPercent: widths[dataIndex++]
        }));

        // 5. PU
        rowCells.push(this.createCell(item.pu.toLocaleString('fr-FR'), {
          size: 17,
          color: "64748B",
          widthPercent: widths[dataIndex++]
        }));

        // 6. Montant
        rowCells.push(this.createCell(item.montant.toLocaleString('fr-FR'), {
          bold: true,
          size: 17,
          color: accentColor,
          align: AlignmentType.RIGHT,
          widthPercent: widths[dataIndex++]
        }));

        tableRows.push(new TableRow({ children: rowCells }));
      });

      // Calcul totaux du groupe
      const totalQte = itemsWithMeta.reduce((sum, item) => sum + item.qte, 0);
      const totalMontant = itemsWithMeta.reduce((sum, item) => sum + item.montant, 0);

      // Row: Ligne de total
      const footerCells: TableCell[] = [];
      if (group.type === 'Chargement Camions') {
        footerCells.push(this.createCell("TOTAL", { bold: true, size: 18, colspan: 2, align: AlignmentType.RIGHT, fill: "F1F5F9" }));
        footerCells.push(this.createCell(totalQte.toLocaleString('fr-FR'), { bold: true, size: 18, fill: "F1F5F9" }));
        footerCells.push(this.createCell("", { fill: "F1F5F9" }));
        footerCells.push(this.createCell(totalMontant.toLocaleString('fr-FR'), { bold: true, size: 18, color: accentColor, align: AlignmentType.RIGHT, fill: "F1F5F9" }));
      } else if (group.type === 'Chargement') {
        const colspan = showDn ? 5 : 4;
        footerCells.push(this.createCell("TOTAL", { bold: true, size: 18, colspan, align: AlignmentType.RIGHT, fill: "F1F5F9" }));
        footerCells.push(this.createCell(totalMontant.toLocaleString('fr-FR'), { bold: true, size: 18, color: accentColor, align: AlignmentType.RIGHT, fill: "F1F5F9" }));
      } else if (isWagon) {
        footerCells.push(this.createCell("TOTAL", { bold: true, size: 18, colspan: 3, align: AlignmentType.RIGHT, fill: "F1F5F9" }));
        footerCells.push(this.createCell(totalQte.toLocaleString('fr-FR'), { bold: true, size: 18, fill: "F1F5F9" }));
        footerCells.push(this.createCell("", { fill: "F1F5F9" }));
        footerCells.push(this.createCell(totalMontant.toLocaleString('fr-FR'), { bold: true, size: 18, color: accentColor, align: AlignmentType.RIGHT, fill: "F1F5F9" }));
      } else {
        footerCells.push(this.createCell("TOTAL", { bold: true, size: 18, colspan: 4, align: AlignmentType.RIGHT, fill: "F1F5F9" }));
        footerCells.push(this.createCell(totalMontant.toLocaleString('fr-FR'), { bold: true, size: 18, color: accentColor, align: AlignmentType.RIGHT, fill: "F1F5F9" }));
      }

      tableRows.push(new TableRow({ children: footerCells }));

      const table = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows
      });

      bodyChildren.push(table);
      bodyChildren.push(new Paragraph({ text: "", spacing: { before: 100, after: 100 } }));
    });



    // Footer de page
    const exportDate = new Date().toLocaleString('fr-FR');
    const footerParagraph = new Paragraph({
      children: [
        new TextRun({
          text: `Rapport généré le ${exportDate} via PortSync Logistics App.`,
          size: 15,
          color: "94A3B8",
          font: "Arial"
        })
      ],
      alignment: AlignmentType.LEFT
    });

    const doc = new Document({
      sections: [{
        children: bodyChildren,
        footers: {
          default: new Footer({
            children: [footerParagraph]
          })
        }
      }]
    });

    this.downloadBlob(doc, filename);
  }

  /**
   * Helper pour regrouper les opérations par type (identique au computed de cahier.component)
   */
  private getGroupedOperations(summary: MonthlySummary) {
    const ops = [...summary.operations];
    const getOpTime = (op: Operation) => {
      const date = op.date || '';
      const heure = op.heure || '00:00';
      return `${date}T${heure}`;
    };

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
      const sortedOps = groups[key].sort((a, b) => {
        return getOpTime(b).localeCompare(getOpTime(a));
      });
      const [type, product] = key.includes('|') ? key.split('|') : [key, ''];
      return {
        type,
        product,
        ops: sortedOps
      };
    });
  }

  /**
   * Crée une cellule de tableau personnalisée pour DOCX
   */
  private createCell(text: string, options: {
    bold?: boolean;
    size?: number;
    color?: string;
    fill?: string;
    align?: "start" | "center" | "end" | "both" | "mediumKashida" | "distribute" | "numTab" | "highKashida" | "lowKashida" | "thaiDistribute" | "left" | "right";
    colspan?: number;
    verticalMerge?: "restart" | "continue";
    widthPercent?: number;
  } = {}): TableCell {
    return new TableCell({
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: text,
              bold: options.bold,
              size: options.size || 18, // 9pt par défaut
              color: options.color || "334155", // slate 700
              font: "Arial"
            })
          ],
          alignment: options.align || AlignmentType.CENTER,
          spacing: { before: 80, after: 80 }
        })
      ],
      verticalAlign: VerticalAlign.CENTER,
      shading: options.fill ? { fill: options.fill } : undefined,
      columnSpan: options.colspan,
      verticalMerge: options.verticalMerge,
      width: options.widthPercent ? { size: options.widthPercent, type: WidthType.PERCENTAGE } : undefined,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
        left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
        right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" }
      }
    });
  }

  /**
   * Crée une cellule pour le tableau de métadonnées (Fiche info)
   */
  private createMetadataCell(label: string, value: string, labelColor: string, valColor: string, isAccentBold = false): TableCell {
    return new TableCell({
      children: [
        new Paragraph({
          children: [
            new TextRun({ text: label + "  ", bold: true, color: labelColor, size: 18, font: "Arial" }),
            new TextRun({ text: value, bold: isAccentBold, color: valColor, size: 18, font: "Arial" })
          ],
          spacing: { before: 80, after: 80 }
        })
      ],
      shading: { fill: "F8FAFC" },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
        left: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
        right: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" }
      }
    });
  }

  /**
   * Crée le tableau pour une opération individuelle
   */
  private createTableForSingleOperation(op: Operation, primaryColor: string): Table {
    const isWagon = op.type.toLowerCase().includes('wagon');
    const showDn = (op.type === 'Chargement' && (op.site === 'AFISA' || op.site === 'SCMC')) || isWagon;

    let headers: string[] = [];
    let widths: number[] = [];

    if (op.type === 'Chargement Camions') {
      headers = ['Date', 'Camions', 'Tonnage (t)', 'PU (FCFA)', 'Montant (FCFA)'];
      widths = [20, 25, 18, 17, 20];
    } else if (showDn) {
      const dnLabel = isWagon ? 'N° Wagon' : 'DN / LTI / ISTI';
      headers = ['Date', dnLabel, 'Produit', 'Qte (t)', 'PU (FCFA)', 'Montant (FCFA)'];
      widths = [18, 20, 24, 12, 11, 15];
    } else {
      headers = ['Date', 'Produit', 'Qte (t)', 'PU (FCFA)', 'Montant (FCFA)'];
      widths = [20, 32, 16, 14, 18];
    }

    const tableRows: TableRow[] = [];

    // Header Row
    tableRows.push(
      new TableRow({
        children: headers.map((h, hIdx) => this.createCell(h, {
          bold: true,
          size: 18,
          color: "FFFFFF",
          fill: primaryColor,
          widthPercent: widths[hIdx]
        }))
      })
    );

    // Data Rows
    const items = op.items || [];
    items.forEach(item => {
      const rowCells: TableCell[] = [];
      let dataIndex = 1;

      // 1. DATE
      rowCells.push(this.createCell(this.formatFrenchDate(item.date), {
        size: 17,
        widthPercent: widths[0]
      }));

      // 2. DN / Wagon / Camion
      if (showDn || op.type === 'Chargement Camions') {
        rowCells.push(this.createCell(item.dn || '-', {
          bold: true,
          size: 17,
          widthPercent: widths[dataIndex++]
        }));
      }

      // 3. Produit
      if (op.type !== 'Chargement Camions') {
        rowCells.push(this.createCell(item.produit || op.produit || '-', {
          align: AlignmentType.LEFT,
          size: 17,
          widthPercent: widths[dataIndex++]
        }));
      }

      // 4. Qte
      rowCells.push(this.createCell(item.qte.toLocaleString('fr-FR'), {
        size: 17,
        widthPercent: widths[dataIndex++]
      }));

      // 5. PU
      rowCells.push(this.createCell(item.pu.toLocaleString('fr-FR'), {
        size: 17,
        color: "64748B",
        widthPercent: widths[dataIndex++]
      }));

      // 6. Montant
      rowCells.push(this.createCell(item.montant.toLocaleString('fr-FR'), {
        bold: true,
        size: 17,
        color: primaryColor,
        align: AlignmentType.RIGHT,
        widthPercent: widths[dataIndex++]
      }));

      tableRows.push(new TableRow({ children: rowCells }));
    });

    // Total Row
    const totalQte = items.reduce((sum, item) => sum + item.qte, 0);
    const totalMontant = items.reduce((sum, item) => sum + item.montant, 0);

    const footerCells: TableCell[] = [];
    if (op.type === 'Chargement Camions') {
      footerCells.push(this.createCell("TOTAL", { bold: true, size: 18, colspan: 2, align: AlignmentType.RIGHT, fill: "F1F5F9" }));
      footerCells.push(this.createCell(totalQte.toLocaleString('fr-FR'), { bold: true, size: 18, fill: "F1F5F9" }));
      footerCells.push(this.createCell("", { fill: "F1F5F9" }));
      footerCells.push(this.createCell(totalMontant.toLocaleString('fr-FR'), { bold: true, size: 18, color: "4F46E5", align: AlignmentType.RIGHT, fill: "F1F5F9" }));
    } else if (op.type === 'Chargement') {
      const colspan = showDn ? 5 : 4;
      footerCells.push(this.createCell("TOTAL", { bold: true, size: 18, colspan, align: AlignmentType.RIGHT, fill: "F1F5F9" }));
      footerCells.push(this.createCell(totalMontant.toLocaleString('fr-FR'), { bold: true, size: 18, color: "4F46E5", align: AlignmentType.RIGHT, fill: "F1F5F9" }));
    } else if (isWagon) {
      footerCells.push(this.createCell("TOTAL", { bold: true, size: 18, colspan: 3, align: AlignmentType.RIGHT, fill: "F1F5F9" }));
      footerCells.push(this.createCell(totalQte.toLocaleString('fr-FR'), { bold: true, size: 18, fill: "F1F5F9" }));
      footerCells.push(this.createCell("", { fill: "F1F5F9" }));
      footerCells.push(this.createCell(totalMontant.toLocaleString('fr-FR'), { bold: true, size: 18, color: "4F46E5", align: AlignmentType.RIGHT, fill: "F1F5F9" }));
    } else {
      footerCells.push(this.createCell("TOTAL", { bold: true, size: 18, colspan: 4, align: AlignmentType.RIGHT, fill: "F1F5F9" }));
      footerCells.push(this.createCell(totalMontant.toLocaleString('fr-FR'), { bold: true, size: 18, color: "4F46E5", align: AlignmentType.RIGHT, fill: "F1F5F9" }));
    }

    tableRows.push(new TableRow({ children: footerCells }));

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: tableRows
    });
  }

  /**
   * Convertit DOCX Document en blob et lance le téléchargement
   */
  private downloadBlob(doc: Document, filename: string): void {
    Packer.toBlob(doc).then((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }).catch(err => {
      console.error("Erreur de génération DOCX :", err);
    });
  }

  /**
   * Formate YYYY-MM-DD en DD/MM/YYYY
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
