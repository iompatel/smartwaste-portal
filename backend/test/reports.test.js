import assert from 'node:assert/strict';
import test from 'node:test';
import PDFDocument from 'pdfkit';
import { buildAccountReport } from '../src/reports.js';

const account = {
  id: 14, firstName: 'Aarav', lastName: 'Patel', email: 'aarav@example.test',
  mobile: '9876543210', address: '18 Garden Road, Ahmedabad', gender: 'Other',
  createdAt: '2026-01-04', lastLoginAt: '2026-11-16T10:30:00Z',
  totalTickets: 5, completedTickets: 3, pendingTickets: 2,
};

function pageCount(buffer) {
  return Number(buffer.toString('latin1').match(/\/Type \/Pages\s+\/Count (\d+)/)?.[1]);
}

async function renderedText(options) {
  const original = PDFDocument.prototype.text;
  const values = [];
  PDFDocument.prototype.text = function (value, ...args) {
    values.push(String(value));
    return original.call(this, value, ...args);
  };
  try {
    const buffer = await buildAccountReport(options);
    return { buffer, text: values.join('\n') };
  } finally {
    PDFDocument.prototype.text = original;
  }
}

test('empty account reports are valid single-page PDFs with useful empty-state copy', async () => {
  const result = await renderedText({ role: 'user', accounts: [], generatedBy: 'Report Administrator' });
  assert.equal(result.buffer.subarray(0, 5).toString(), '%PDF-');
  assert.equal(pageCount(result.buffer), 1);
  assert.match(result.text, /No accounts match this report/);
  assert.match(result.text, /1 \/ 1/);
});

test('account report fields exclude secrets even when supplied by the caller', async () => {
  const result = await renderedText({
    role: 'worker', generatedBy: { firstName: 'Meera', lastName: 'Shah', passwordHash: 'ISSUER_SECRET' },
    accounts: [{ ...account, password: 'PASSWORD_SECRET', passwordHash: 'HASH_SECRET', completionCode: 'OTP_SECRET', token: 'TOKEN_SECRET' }],
  });
  assert.match(result.text, /Aarav Patel/);
  assert.match(result.text, /aarav@example.test/);
  assert.match(result.text, /Meera Shah/);
  assert.doesNotMatch(result.text, /PASSWORD_SECRET|HASH_SECRET|OTP_SECRET|TOKEN_SECRET|ISSUER_SECRET/);
});

test('pagination retains every account and the end of unusually long unbroken values', async () => {
  const rows = Array.from({ length: 24 }, (_, index) => ({ ...account, id: index + 1, firstName: `Resident${index + 1}`, lastName: 'Register' }));
  rows[7].address = `${'LongUnbrokenAddress'.repeat(350)} FINAL_ADDRESS_MARKER`;
  const result = await renderedText({ role: 'user', accounts: rows, generatedBy: 'Report Administrator' });
  assert.ok(pageCount(result.buffer) > 1);
  for (let index = 1; index <= rows.length; index += 1) assert.match(result.text, new RegExp(`Account ID: ${index}(?:\\n|$)`));
  assert.match(result.text, /FINAL_ADDRESS_MARKER/);
  assert.match(result.text, /Account 8 continued/);
});

test('report generation rejects unsupported account roles', async () => {
  await assert.rejects(() => buildAccountReport({ role: 'admin', accounts: [] }), /role must be user or worker/);
});
