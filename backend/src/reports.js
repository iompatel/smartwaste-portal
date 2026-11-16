import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

const COLOR = {
  forest: '#123C32', teal: '#16705E', ink: '#233C35', muted: '#66766E',
  line: '#DCE5DF', pale: '#F3F7F4', white: '#FFFFFF', lime: '#D8EDAB',
};
const MARGIN = 42;
const LINE_HEIGHT = 12.4;
const FONT_SIZE = 9;
const FONT_DIR = new URL('../assets/fonts/', import.meta.url);

function text(value, fallback = 'Not recorded') {
  const result = String(value ?? '').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim();
  return result || fallback;
}

function count(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function dateLabel(value, withTime = false) {
  const date = validDate(value);
  if (!date) return 'Not recorded';
  const label = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  }).format(date);
  return withTime ? `${label} UTC` : label;
}

function fontFor(value, bold = false) {
  if (/[\u0900-\u097F]/u.test(value)) return 'Devanagari';
  if (/[\u0A80-\u0AFF]/u.test(value)) return 'Gujarati';
  return bold ? 'SansBold' : 'Sans';
}

function fontRuns(value, bold = false) {
  const runs = [];
  for (const character of value) {
    const font = fontFor(character, bold);
    const last = runs.at(-1);
    if (last?.font === font) last.value += character;
    else runs.push({ value: character, font });
  }
  return runs;
}

function measure(doc, value, { size = FONT_SIZE, bold = false } = {}) {
  return fontRuns(value, bold).reduce((width, run) => {
    doc.font(run.font).fontSize(size);
    return width + doc.widthOfString(run.value);
  }, 0);
}

function write(doc, value, x, y, { size = FONT_SIZE, color = COLOR.ink, bold = false, ...options } = {}) {
  const runs = fontRuns(value, bold);
  if (runs.length <= 1) {
    doc.font(runs[0]?.font ?? 'Sans').fontSize(size).fillColor(color).text(value, x, y, options);
    return;
  }
  const width = measure(doc, value, { size, bold });
  let runX = x + (options.align === 'center' ? ((options.width ?? width) - width) / 2 : options.align === 'right' ? (options.width ?? width) - width : 0);
  doc.font(bold ? 'SansBold' : 'Sans');
  const commonAscender = doc._font.ascender;
  for (const run of runs) {
    doc.font(run.font).fontSize(size).fillColor(color);
    const baselineOffset = (commonAscender - doc._font.ascender) * size / 1000;
    doc.text(run.value, runX, y + baselineOffset, { lineBreak: false });
    runX += doc.widthOfString(run.value);
  }
}

// Wrap both ordinary prose and unbroken values before pagination. Each line is
// measured with the same embedded font that will render it.
function wrap(doc, value, width, options = {}) {
  const content = text(value);
  const lines = [];
  for (const paragraph of content.split(/\r?\n/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const combined = line ? `${line} ${word}` : word;
      if (measure(doc, combined, options) <= width) {
        line = combined;
        continue;
      }
      if (line) lines.push({ value: line, ...options });
      line = '';
      for (const character of word) {
        if (line && measure(doc, line + character, options) > width) {
          lines.push({ value: line, ...options });
          line = '';
        }
        line += character;
      }
    }
    if (line) lines.push({ value: line, ...options });
    else if (!paragraph.trim()) lines.push({ value: '', ...options });
  }
  return lines;
}

function seal(doc, cx, cy) {
  doc.save().strokeColor(COLOR.teal).lineWidth(1.5);
  doc.circle(cx, cy, 43).stroke().circle(cx, cy, 38).lineWidth(0.55).stroke();
  const label = 'SMART WASTE CORPORATION';
  for (let index = 0; index < label.length; index += 1) {
    const angle = -76 + index * 152 / (label.length - 1);
    doc.save().rotate(angle, { origin: [cx, cy] });
    write(doc, label[index], cx - 3, cy - 35, { size: 6.2, bold: true, color: COLOR.teal, lineBreak: false });
    doc.restore();
  }
  doc.fillColor(COLOR.teal).moveTo(cx - 10, cy + 1)
    .bezierCurveTo(cx - 12, cy - 17, cx + 5, cy - 21, cx + 15, cy - 15)
    .bezierCurveTo(cx + 13, cy - 2, cx + 2, cy + 7, cx - 10, cy + 1).fill();
  doc.strokeColor(COLOR.white).lineWidth(1).moveTo(cx - 7, cy + 1).lineTo(cx + 8, cy - 12).stroke();
  write(doc, 'SWC', cx - 22, cy + 8, { size: 12, bold: true, color: COLOR.teal, width: 44, align: 'center' });
  write(doc, 'SYSTEM GENERATED', cx - 30, cy + 25, { size: 4.8, bold: true, color: COLOR.teal, width: 60, align: 'center' });
  doc.restore();
}

function metric(doc, x, y, width, label, value, accent = false) {
  doc.roundedRect(x, y, width, 66, 6).fill(accent ? COLOR.forest : COLOR.pale);
  write(doc, label, x + 13, y + 11, { size: 8.3, color: accent ? COLOR.lime : COLOR.muted });
  write(doc, Number(value).toLocaleString('en-GB'), x + 13, y + 28, {
    size: 24, bold: true, color: accent ? COLOR.white : COLOR.forest,
  });
}

function registrationPeriod(period) {
  if (period?.from && period?.to) return `${dateLabel(period.from)} to ${dateLabel(period.to)}`;
  if (period?.from) return `From ${dateLabel(period.from)}`;
  if (period?.to) return `Through ${dateLabel(period.to)}`;
  return 'All registration dates';
}

function issuerLabel(generatedBy) {
  if (typeof generatedBy === 'string') return text(generatedBy, 'Administrator');
  const name = [generatedBy?.firstName, generatedBy?.lastName].filter(Boolean).join(' ');
  return text(name || generatedBy?.name || generatedBy?.email, 'Administrator');
}

/** Builds an account register using only explicitly selected, non-secret fields. */
export async function buildAccountReport({ role, accounts = [], generatedBy, generatedAt = new Date(), period = {} }) {
  if (!['user', 'worker'].includes(role)) throw new TypeError('Report role must be user or worker.');
  if (!Array.isArray(accounts)) throw new TypeError('Report accounts must be an array.');
  const created = validDate(generatedAt) ?? new Date();
  const category = role === 'worker' ? 'Worker' : 'Citizen';
  const reportId = `SWC-${role === 'worker' ? 'WRK' : 'USR'}-${created.toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const issuer = issuerLabel(generatedBy);
  const doc = new PDFDocument({
    size: 'A4', margin: MARGIN, autoFirstPage: false, bufferPages: true,
    info: {
      Title: `${category} account report`, Author: 'Smart Waste Corporation',
      Subject: `${category} account register and ticket activity`, CreationDate: created,
    },
  });
  doc.registerFont('Sans', fileURLToPath(new URL('NotoSans-Regular.ttf', FONT_DIR)));
  doc.registerFont('SansBold', fileURLToPath(new URL('NotoSans-Bold.ttf', FONT_DIR)));
  doc.registerFont('Devanagari', fileURLToPath(new URL('NotoSansDevanagari-Regular.ttf', FONT_DIR)));
  doc.registerFont('Gujarati', fileURLToPath(new URL('NotoSansGujarati-Regular.ttf', FONT_DIR)));
  const chunks = [];
  const finished = new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const pageWidth = 595.28;
  const contentWidth = pageWidth - MARGIN * 2;
  const widths = [28, 182, 193, contentWidth - 403];
  const totalTickets = accounts.reduce((total, account) => total + count(account.totalTickets), 0);
  const completedTickets = accounts.reduce((total, account) => total + count(account.completedTickets), 0);
  const pendingTickets = accounts.reduce((total, account) => total + count(account.pendingTickets), 0);
  const registerBottom = 760;
  let cursor = 0;
  let pageNumber = 0;

  function tableHeading(y) {
    doc.rect(MARGIN, y, contentWidth, 27).fill(COLOR.forest);
    let x = MARGIN;
    ['NO.', 'ACCOUNT / ACTIVITY', 'CONTACT / ADDRESS', 'TICKET TOTALS'].forEach((label, index) => {
      write(doc, label, x + 8, y + 8, { size: index === 3 ? 7 : 7.8, bold: true, color: COLOR.white, width: widths[index] - 12 });
      x += widths[index];
    });
    return y + 27;
  }

  function addRegisterPage(first = false) {
    doc.addPage();
    pageNumber += 1;
    doc.rect(0, 0, pageWidth, 8).fill(COLOR.forest);
    if (first) {
      write(doc, 'SMART WASTE CORPORATION', MARGIN, 39, { size: 12.5, bold: true, color: COLOR.forest, characterSpacing: 0.7 });
      write(doc, 'Environmental Services  /  Administration', MARGIN, 60, { size: 9, color: COLOR.muted });
      seal(doc, pageWidth - MARGIN - 44, 84);
      write(doc, `${category} account report`, MARGIN, 101, { size: 25, bold: true, color: COLOR.forest, width: contentWidth - 100 });
      write(doc, 'ACCOUNT REGISTER AND SERVICE ACTIVITY', MARGIN, 141, { size: 8.5, bold: true, color: COLOR.teal, characterSpacing: 1 });
      doc.moveTo(MARGIN, 161).lineTo(pageWidth - MARGIN, 161).strokeColor(COLOR.line).lineWidth(1).stroke();
      const issuerLines = wrap(doc, issuer, contentWidth - 122, { size: 9.2 });
      const metadataHeight = 86 + Math.max(0, issuerLines.length - 1) * LINE_HEIGHT;
      doc.roundedRect(MARGIN, 176, contentWidth, metadataHeight, 6).fill(COLOR.pale);
      [['Report ID', reportId], ['Generated', dateLabel(created, true)], ['Issued by', issuer], ['Registration period', registrationPeriod(period)]].forEach(([label, value], index) => {
        const y = 187 + index * 18 + (index === 3 ? Math.max(0, issuerLines.length - 1) * LINE_HEIGHT : 0);
        write(doc, label.toUpperCase(), MARGIN + 12, y, { size: 7.7, bold: true, color: COLOR.muted, width: 102 });
        if (index === 2) issuerLines.forEach((line, offset) => write(doc, line.value, MARGIN + 116, y + offset * LINE_HEIGHT, { size: 9.2 }));
        else write(doc, value, MARGIN + 116, y, { size: 9.2, width: contentWidth - 130 });
      });
      const metricY = 176 + metadataHeight + 16;
      const metricWidth = (contentWidth - 20) / 3;
      metric(doc, MARGIN, metricY, metricWidth, `${category.toUpperCase()} ACCOUNTS`, accounts.length, true);
      metric(doc, MARGIN + metricWidth + 10, metricY, metricWidth, 'TOTAL TICKETS', totalTickets);
      metric(doc, MARGIN + 2 * (metricWidth + 10), metricY, metricWidth, 'COMPLETED TICKETS', completedTickets);
      write(doc, `${pendingTickets.toLocaleString('en-GB')} open tickets across the selected accounts. Ticket totals cover all account activity.`, MARGIN, metricY + 81, { size: 9.5, color: COLOR.muted, width: contentWidth });
      const tableY = metricY + 129;
      write(doc, `${category} account register`, MARGIN, tableY - 27, { size: 12.5, bold: true, color: COLOR.forest });
      cursor = tableHeading(tableY);
    } else {
      write(doc, 'SMART WASTE CORPORATION', MARGIN, 35, { size: 11.5, bold: true, color: COLOR.forest, characterSpacing: 0.5 });
      write(doc, `${category} account register`, MARGIN, 58, { size: 18, bold: true, color: COLOR.forest });
      write(doc, `${reportId}  |  Continued account register`, MARGIN, 89, { size: 8, color: COLOR.muted, width: contentWidth });
      doc.moveTo(MARGIN, 111).lineTo(pageWidth - MARGIN, 111).strokeColor(COLOR.line).lineWidth(1).stroke();
      cursor = tableHeading(126);
    }
  }

  addRegisterPage(true);
  if (cursor > registerBottom - 80) addRegisterPage();
  accounts.forEach((account, accountIndex) => {
    const workerSeen = validDate(account.workerLastSeenAt);
    const online = account.workerOnline === true && workerSeen && created.getTime() - workerSeen.getTime() <= 120_000;
    const activity = [
      [text(`${text(account.firstName, '')} ${text(account.lastName, '')}`, 'Unnamed account'), { bold: true, color: COLOR.forest }],
      [`Account ID: ${text(account.id)}`, { color: COLOR.muted }],
      [`Gender: ${text(account.gender)}`, {}],
      [`Registered: ${dateLabel(account.createdAt)}`, {}],
      [`Last login: ${dateLabel(account.lastLoginAt, true)}`, {}],
      ...(role === 'worker' ? [[`Last seen: ${dateLabel(account.workerLastSeenAt, true)}`, {}]] : []),
    ];
    const contact = [
      [`Email: ${text(account.email)}`, {}],
      [`Mobile: ${text(account.mobile)}`, {}],
      [`Address: ${text(account.address)}`, {}],
    ];
    const workload = [
      [`Total: ${count(account.totalTickets).toLocaleString('en-GB')}`, { bold: true, color: COLOR.forest }],
      [`Completed: ${count(account.completedTickets).toLocaleString('en-GB')}`, {}],
      [`Open: ${count(account.pendingTickets).toLocaleString('en-GB')}`, {}],
      ...(role === 'worker' ? [[`Availability: ${online ? 'Online' : 'Offline'}`, { color: COLOR.teal }]] : []),
    ];
    const columns = [
      wrap(doc, String(accountIndex + 1), widths[0] - 14, { color: COLOR.muted }),
      activity.flatMap(([value, options]) => wrap(doc, value, widths[1] - 16, options)),
      contact.flatMap(([value, options]) => wrap(doc, value, widths[2] - 16, options)),
      workload.flatMap(([value, options]) => wrap(doc, value, widths[3] - 16, options)),
    ];
    const offsets = [0, 0, 0, 0];
    const totalLines = Math.max(...columns.map((column) => column.length));
    const completeHeight = totalLines * LINE_HEIGHT + 20;
    if (completeHeight <= registerBottom - 153 && cursor + completeHeight > registerBottom) addRegisterPage();
    let continuation = false;
    while (columns.some((column, index) => offsets[index] < column.length)) {
      const capacity = Math.floor((registerBottom - cursor - 20) / LINE_HEIGHT);
      if (capacity < 2) {
        addRegisterPage();
        continue;
      }
      const lineCount = Math.min(capacity, Math.max(...columns.map((column, index) => column.length - offsets[index])));
      const rowHeight = lineCount * LINE_HEIGHT + 20;
      doc.rect(MARGIN, cursor, contentWidth, rowHeight).fill(accountIndex % 2 === 0 ? COLOR.white : COLOR.pale);
      let x = MARGIN;
      columns.forEach((column, columnIndex) => {
        column.slice(offsets[columnIndex], offsets[columnIndex] + lineCount).forEach((line, lineIndex) => {
          write(doc, line.value, x + 8, cursor + 9 + lineIndex * LINE_HEIGHT, { ...line, width: widths[columnIndex] - 16, lineBreak: false });
        });
        offsets[columnIndex] += lineCount;
        x += widths[columnIndex];
      });
      doc.moveTo(MARGIN, cursor + rowHeight).lineTo(pageWidth - MARGIN, cursor + rowHeight).strokeColor(COLOR.line).lineWidth(0.55).stroke();
      cursor += rowHeight;
      continuation = columns.some((column, index) => offsets[index] < column.length);
      if (continuation) {
        addRegisterPage();
        write(doc, `Account ${accountIndex + 1} continued`, MARGIN + 8, cursor + 4, { size: 7.5, color: COLOR.muted });
        cursor += 19;
      }
    }
  });
  if (!accounts.length) {
    doc.roundedRect(MARGIN, cursor + 18, contentWidth, 92, 6).fill(COLOR.pale);
    write(doc, 'No accounts match this report', MARGIN + 18, cursor + 38, { size: 13, bold: true, color: COLOR.forest });
    write(doc, 'Try a wider registration date range, or generate the report after accounts have been created.', MARGIN + 18, cursor + 63, { size: 10, color: COLOR.muted, width: contentWidth - 36 });
  }

  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    // Footers deliberately occupy the bottom margin. Keep PDFKit's automatic
    // text pagination from creating an extra page for the page number.
    doc.page.margins.bottom = 0;
    doc.moveTo(MARGIN, 782).lineTo(pageWidth - MARGIN, 782).strokeColor(COLOR.line).lineWidth(0.7).stroke();
    write(doc, 'System-generated corporation report', MARGIN, 794, { size: 7.5, color: COLOR.muted, lineBreak: false });
    write(doc, `${index + 1} / ${pageNumber}`, pageWidth - MARGIN - 65, 794, { size: 8, color: COLOR.forest, align: 'right', width: 65, lineBreak: false });
    write(doc, 'Administrative use  |  Account information is confidential', MARGIN, 808, { size: 6.7, color: COLOR.muted, lineBreak: false });
  }
  doc.end();
  return finished;
}
