import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePrompt, parseCsv, toImportRow } from '../src/question-import.mjs';

test('CSV parser handles quoted commas, escaped quotes, and multiline fields', () => {
  const rows = parseCsv('prompt,choices,answer_key\r\n"What, exactly?","A. ""quoted""\nB. second",B');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].prompt, 'What, exactly?');
  assert.equal(rows[0].choices, 'A. "quoted"\nB. second');
  assert.equal(rows[0].__sourceRow, 2);
});

test('CSV parser strips BOM and preserves blank trailing cells', () => {
  const rows = parseCsv('\uFEFFprompt,answer_key,explanation\nQuestion,A,');
  assert.deepEqual(rows[0], { prompt: 'Question', answer_key: 'A', explanation: '', __sourceRow: 2 });
});

test('CSV parser rejects malformed quoted fields', () => {
  assert.throws(() => parseCsv('prompt,answer\n"unfinished,A'), /unterminated quoted field/);
  assert.throws(() => parseCsv('prompt,answer\n"ok"x,A'), /unexpected characters/);
});

test('CSV parser rejects empty and duplicate headers', () => {
  assert.throws(() => parseCsv('prompt,,answer\nQ,,A'), /empty column heading/);
  assert.throws(() => parseCsv('prompt,Prompt\nQ,Q'), /duplicate column headings/);
});

test('spreadsheet option columns map A-D and letter answer to option text', () => {
  const row = toImportRow({ question: 'Choose the answer', choice_a: 'Alpha', option_b: 'Beta', choice_c: 'Gamma', option_d: 'Delta', answer_key: 'B' }, 7);
  assert.deepEqual(row.choices, ['Alpha', 'Beta', 'Gamma', 'Delta']);
  assert.equal(row.answer_key, 'Beta');
  assert.deepEqual(row.errors, []);
});

test('JSON choices and lettered answer keys are normalized', () => {
  const row = toImportRow({ prompt: 'Pick one', choices: '["Red","Blue"]', answer: 'A)', points: 2 }, 1);
  assert.deepEqual(row.choices, ['Red', 'Blue']);
  assert.equal(row.answer_key, 'Red');
  assert.deepEqual(row.errors, []);
});

test('choice labels are compared after normalization', () => {
  const row = toImportRow({ prompt: 'Pick one', choices: ['Option A', 'Option B'], answer_key: ' option-b ' }, 1);
  assert.deepEqual(row.errors, []);
});

test('duplicate choices, invalid point values and unsupported types are rejected', () => {
  const row = toImportRow({ prompt: 'Pick', choices: ['Same', 'Same'], answer_key: 'A', points: 0 }, 4);
  assert.ok(row.errors.some(error => error.includes('unique')));
  assert.ok(row.errors.some(error => error.includes('between 0 and 100')));
  const unsupported = toImportRow({ prompt: 'Pick', question_type: 'true_false' }, 5);
  assert.ok(unsupported.errors.some(error => error.includes('Unsupported question type')));
});

test('existing question prompts are flagged as duplicates', () => {
  const row = toImportRow({ prompt: 'A question!', choices: ['A', 'B'], answer_key: 'A' }, 3, new Set([normalizePrompt('A question!')]));
  assert.equal(row.duplicate, true);
  assert.ok(row.errors.some(error => error.includes('duplicate')));
});

test('multiple-choice imports reject fewer than two or more than six options', () => {
  const tooFew = toImportRow({ prompt: 'Question', choices: ['A'], answer_key: 'A' }, 1);
  const tooMany = toImportRow({ prompt: 'Question', choices: ['A','B','C','D','E','F','G'], answer_key: 'A' }, 2);
  assert.ok(tooFew.errors.some(error => error.includes('between 2 and 6')));
  assert.ok(tooMany.errors.some(error => error.includes('between 2 and 6')));
});
