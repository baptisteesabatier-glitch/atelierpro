import PDFDocument from 'pdfkit';
import type { Client, Quote, QuoteItem, Repair, Setting, User } from '@prisma/client';
import type { Response } from 'express';

const NAVY = '#0b1220';
const MUTED = '#5b6675';
const ACCENT = '#119a8b';
const LINE = '#dde2e8';
const SOFT = '#f4f6f8';

export const money = (cents: number): string =>
  `${(cents / 100).toFixed(2).replace('.', ',')} €`;

const dateFr = (value: Date | string): string =>
  new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(value),
  );

function fileSafe(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

interface HeaderMeta {
  label: string;
  value: string;
}

function drawHeader(
  doc: PDFKit.PDFDocument,
  settings: Setting,
  title: string,
  metas: HeaderMeta[],
): number {
  if (settings.logoDataUrl?.includes(',')) {
    try {
      const buffer = Buffer.from(settings.logoDataUrl.split(',')[1], 'base64');
      doc.image(buffer, 50, 46, { fit: [110, 46] });
    } catch {
      /* logo illisible : on l'ignore, le document reste valide */
    }
  } else {
    doc
      .roundedRect(50, 46, 46, 46, 10)
      .fillColor(SOFT)
      .fill()
      .fillColor(NAVY)
      .font('Helvetica-Bold')
      .fontSize(16)
      .text('AP', 50, 61, { width: 46, align: 'center' });
  }

  doc
    .fillColor(NAVY)
    .font('Helvetica-Bold')
    .fontSize(15)
    .text(settings.companyName || 'AtelierPro', 176, 48, { width: 370, align: 'right' });

  const address = [settings.address, [settings.postalCode, settings.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(' · ');
  const contact = [settings.phone, settings.email].filter(Boolean).join(' · ');

  doc.font('Helvetica').fontSize(8.5).fillColor(MUTED);
  if (address) doc.text(address, 176, 68, { width: 370, align: 'right' });
  if (contact) doc.text(contact, 176, 80, { width: 370, align: 'right' });

  doc
    .moveTo(50, 106)
    .lineTo(545, 106)
    .lineWidth(1.4)
    .strokeColor(ACCENT)
    .stroke();

  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(19).text(title, 50, 122);
  doc.font('Helvetica').fontSize(9).fillColor(MUTED);
  let y = 150;
  for (const meta of metas) {
    doc.text(`${meta.label} : `, 50, y, { continued: true, width: 495 });
    doc.fillColor(NAVY).text(meta.value);
    doc.fillColor(MUTED);
    y += 14;
  }
  return y + 8;
}

function drawPartyBox(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  title: string,
  lines: string[],
): number {
  doc.roundedRect(x, y, width, 92, 8).fillColor(SOFT).fill();
  doc
    .fillColor(MUTED)
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .text(title.toUpperCase(), x + 14, y + 12, { width: width - 28 });
  doc.font('Helvetica').fontSize(9).fillColor(NAVY);
  let cursor = y + 26;
  for (const line of lines.filter(Boolean)) {
    doc.text(line, x + 14, cursor, { width: width - 28 });
    cursor += 13;
  }
  return y + 92;
}

function drawFooter(doc: PDFKit.PDFDocument, settings: Setting): void {
  const legal = [
    settings.legalName ? `${settings.legalName}` : '',
    settings.siret ? `SIRET ${settings.siret}` : '',
    settings.vatNumber ? `TVA ${settings.vatNumber}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  doc
    .moveTo(50, 762)
    .lineTo(545, 762)
    .lineWidth(0.6)
    .strokeColor(LINE)
    .stroke()
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor(MUTED)
    .text(legal || settings.companyName, 50, 770, { width: 495 });

  if (settings.footer) {
    doc.text(settings.footer, 50, 782, { width: 495 });
  }
}

function startPdf(res: Response, filename: string): PDFKit.PDFDocument {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    info: { Producer: 'AtelierPro 2.0', Creator: 'AtelierPro' },
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${fileSafe(filename)}.pdf"`,
  );
  res.setHeader('Cache-Control', 'no-store');
  doc.pipe(res);
  return doc;
}

function clientLines(client: Client): string[] {
  return [
    client.name,
    client.address ?? '',
    [client.postalCode, client.city].filter(Boolean).join(' '),
    client.phone,
    client.email ?? '',
  ];
}

/* ------------------------------------------------------------------ */
/* Devis                                                              */
/* ------------------------------------------------------------------ */

export async function renderQuote(
  res: Response,
  quote: Quote & { items: QuoteItem[]; repair: Repair & { client: Client } },
  settings: Setting,
): Promise<void> {
  const doc = startPdf(res, `${quote.number}-${quote.repair.reference}`);
  drawHeader(doc, settings, 'DEVIS', [
    { label: 'Numéro', value: quote.number },
    { label: 'Date', value: dateFr(quote.issuedAt) },
    { label: 'Validité', value: `${dateFr(quote.validUntil)} (${settings.quoteValidityDays} jours)` },
    { label: 'Dossier', value: quote.repair.reference },
  ]);

  let y = drawPartyBox(doc, 50, 178, 237, 'Client', clientLines(quote.repair.client));
  drawPartyBox(doc, 308, 178, 237, 'Appareil', [
    `${quote.repair.brand} ${quote.repair.model}`,
    quote.repair.serialNumber ? `N° de série : ${quote.repair.serialNumber}` : '',
    quote.repair.issue.slice(0, 110),
  ]);

  y += 26;
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(8.5);
  const cols = { label: 50, qty: 330, unit: 400, total: 462 };
  doc.text('DÉSIGNATION', cols.label, y);
  doc.text('QTÉ', cols.qty, y, { width: 45, align: 'right' });
  doc.text('P.U. HT', cols.unit, y, { width: 60, align: 'right' });
  doc.text('TOTAL HT', cols.total, y, { width: 83, align: 'right' });

  y += 14;
  doc.moveTo(50, y).lineTo(545, y).strokeColor(LINE).lineWidth(0.8).stroke();
  y += 8;

  doc.font('Helvetica').fontSize(9).fillColor(NAVY);
  for (const item of quote.items) {
    if (y > 690) {
      drawFooter(doc, settings);
      doc.addPage();
      y = 60;
    }
    const lineTotal = Math.round(item.quantity * item.unitPriceCents);
    doc.text(item.label, cols.label, y, { width: 270 });
    const labelHeight = doc.heightOfString(item.label, { width: 270 });
    doc.text(String(item.quantity).replace('.', ','), cols.qty, y, { width: 45, align: 'right' });
    doc.text(money(item.unitPriceCents), cols.unit, y, { width: 60, align: 'right' });
    doc.text(money(lineTotal), cols.total, y, { width: 83, align: 'right' });
    y += Math.max(16, labelHeight + 4);
  }

  y += 4;
  doc.moveTo(50, y).lineTo(545, y).strokeColor(LINE).lineWidth(0.8).stroke();
  y += 14;

  const totalsX = 330;
  const rows: [string, string, boolean?][] = [
    ['Total HT', money(quote.subtotalCents)],
    [`TVA ${quote.vatRate} %`, money(quote.vatCents)],
    ['Total TTC', money(quote.totalCents), true],
  ];
  for (const [label, value, strong] of rows) {
    doc
      .font(strong ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(strong ? 11 : 9)
      .fillColor(strong ? NAVY : MUTED)
      .text(label, totalsX, y, { width: 110, align: 'right' });
    doc
      .fillColor(strong ? NAVY : MUTED)
      .text(value, totalsX + 110, y, { width: 105, align: 'right' });
    y += strong ? 20 : 14;
  }

  y += 18;
  doc
    .roundedRect(50, y, 495, 58, 8)
    .strokeColor(LINE)
    .lineWidth(0.8)
    .stroke();
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(MUTED)
    .text('CONDITIONS', 64, y + 10);
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(MUTED)
    .text(
      quote.notes ||
        `Devis valable ${settings.quoteValidityDays} jours. Réparation engagée après accord écrit du client. Aucun déverrouillage d'appareil ni mot de passe client n'est demandé.`,
      64,
      y + 22,
      { width: 467 },
    );

  y += 78;
  doc.font('Helvetica').fontSize(8).fillColor(MUTED);
  doc.text('Bon pour accord (date et signature du client) :', 50, y);
  doc
    .moveTo(50, y + 40)
    .lineTo(250, y + 40)
    .strokeColor(LINE)
    .stroke();
  doc.text('Cachet et signature de l’atelier :', 308, y);
  doc
    .moveTo(308, y + 40)
    .lineTo(545, y + 40)
    .strokeColor(LINE)
    .stroke();

  drawFooter(doc, settings);
  doc.end();
  await finished(res);
}

/* ------------------------------------------------------------------ */
/* Bons de dépôt et de restitution                                    */
/* ------------------------------------------------------------------ */

type RepairWithClient = Repair & { client: Client; assignedTo: User | null };

export async function renderDepositSlip(
  res: Response,
  repair: RepairWithClient,
  settings: Setting,
): Promise<void> {
  const doc = startPdf(res, `bon-depot-${repair.reference}`);
  const y = drawHeader(doc, settings, 'BON DE DÉPÔT', [
    { label: 'Dossier', value: repair.reference },
    { label: 'Date de dépôt', value: dateFr(repair.receivedAt) },
    { label: 'Prise en charge', value: dateFr(repair.receivedAt) },
  ]);

  let cursor = drawPartyBox(doc, 50, y + 8, 237, 'Client', clientLines(repair.client));
  drawPartyBox(doc, 308, y + 8, 237, 'Appareil', [
    `${repair.brand} ${repair.model}`,
    repair.serialNumber ? `N° de série : ${repair.serialNumber}` : 'N° de série : non renseigné',
  ]);

  cursor += 24;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY).text('PANNE SIGNALÉE', 50, cursor);
  doc.font('Helvetica').fontSize(9).fillColor(NAVY).text(repair.issue, 50, cursor + 14, {
    width: 495,
  });

  cursor += 14 + doc.heightOfString(repair.issue, { width: 495 }) + 20;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text('MONTANT ESTIMÉ', 50, cursor);
  doc.font('Helvetica').fontSize(11).fillColor(NAVY).text(money(repair.estimateCents), 50, cursor + 13);

  cursor += 46;
  doc.roundedRect(50, cursor, 495, 108, 8).strokeColor(LINE).lineWidth(0.8).stroke();
  doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text('CONDITIONS DE DÉPÔT', 64, cursor + 12);
  doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(
    [
      `L'appareil est déposé pour diagnostic et réparation à l'atelier ${settings.companyName || ''}.`,
      'Aucun code de déverrouillage ni mot de passe client n’est demandé, collecté ou conservé.',
      'Un devis sera établi après diagnostic ; la réparation n’est engagée qu’après accord du client.',
      'Les appareils non retirés dans un délai de 90 jours peuvent faire l’objet d’une procédure de vente.',
    ].join('\n'),
    64,
    cursor + 26,
    { width: 467, lineGap: 2 },
  );

  cursor += 132;
  doc.font('Helvetica').fontSize(8).fillColor(MUTED);
  doc.text('Signature du client (dépôt) :', 50, cursor);
  doc.moveTo(50, cursor + 36).lineTo(250, cursor + 36).strokeColor(LINE).stroke();
  doc.text('Pour l’atelier :', 308, cursor);
  doc.moveTo(308, cursor + 36).lineTo(545, cursor + 36).strokeColor(LINE).stroke();

  drawFooter(doc, settings);
  doc.end();
  await finished(res);
}

export async function renderReturnSlip(
  res: Response,
  repair: RepairWithClient,
  settings: Setting,
): Promise<void> {
  const doc = startPdf(res, `bon-restitution-${repair.reference}`);
  const y = drawHeader(doc, settings, 'BON DE RESTITUTION', [
    { label: 'Dossier', value: repair.reference },
    { label: 'Date de restitution', value: dateFr(repair.returnedAt ?? new Date()) },
    { label: 'Technicien', value: repair.assignedTo?.name ?? '—' },
  ]);

  let cursor = drawPartyBox(doc, 50, y + 8, 237, 'Client', clientLines(repair.client));
  drawPartyBox(doc, 308, y + 8, 237, 'Appareil', [
    `${repair.brand} ${repair.model}`,
    repair.serialNumber ? `N° de série : ${repair.serialNumber}` : '',
  ]);

  cursor += 24;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY).text('TRAVAUX EFFECTUÉS', 50, cursor);
  const summary = repair.diagnosis || repair.issue;
  doc.font('Helvetica').fontSize(9).fillColor(NAVY).text(summary, 50, cursor + 14, { width: 495 });

  cursor += 14 + doc.heightOfString(summary, { width: 495 }) + 18;
  const rows: [string, string][] = [
    ['Montant estimé', money(repair.estimateCents)],
    ['Montant réglé', money(repair.paidAmountCents)],
  ];
  for (const [label, value] of rows) {
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(label, 50, cursor);
    doc.fillColor(NAVY).text(value, 360, cursor, { width: 185, align: 'right' });
    cursor += 16;
  }

  cursor += 16;
  doc.roundedRect(50, cursor, 495, 74, 8).strokeColor(LINE).lineWidth(0.8).stroke();
  doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text('MENTIONS', 64, cursor + 12);
  doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(
    'Le client déclare avoir récupéré l’appareil décrit ci-dessus et avoir vérifié son bon fonctionnement en présence du technicien. Toute réclamation sur les dommages apparents doit être formulée immédiatement.',
    64,
    cursor + 26,
    { width: 467, lineGap: 2 },
  );

  cursor += 98;
  doc.font('Helvetica').fontSize(8).fillColor(MUTED);
  doc.text('Signature du client (restitution) :', 50, cursor);
  doc.moveTo(50, cursor + 36).lineTo(250, cursor + 36).strokeColor(LINE).stroke();

  drawFooter(doc, settings);
  doc.end();
  await finished(res);
}

function finished(res: Response): Promise<void> {
  if (res.writableFinished) return Promise.resolve();
  return new Promise((resolve, reject) => {
    res.on('finish', () => resolve());
    res.on('close', () => resolve());
    res.on('error', reject);
  });
}
