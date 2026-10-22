import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInquiry, formatInquiry } from '../src/inquiry.js';

const base = { name: ' Анна ', specialization: ' Психолог ', contact: 'anna@example.ru', message: '' };
test('rejects whitespace required fields and preserves optional empty message', () => {
  const result = validateInquiry({ name: '  ', specialization: '\n ', contact: ' ', message: '' });
  assert.deepEqual(Object.keys(result.errors), ['name', 'specialization', 'contact']);
});
test('accepts Cyrillic names and normalizes input', () => {
  const result = validateInquiry(base);
  assert.equal(result.valid, true);
  assert.equal(result.values.name, 'Анна');
  assert.equal(result.values.specialization, 'Психолог');
});
test('accepts three real contact formats and rejects ambiguous contact', () => {
  for (const contact of ['anna@example.ru', '+7 (900) 123-45-67', '@anna_practice']) assert.equal(validateInquiry({ ...base, contact }).valid, true, contact);
  for (const contact of ['привет', 'a@b', '@ab', '1234', 'anna@site..ru', '1234567890123456', 'anna\n@example.ru']) assert.equal(validateInquiry({ ...base, contact }).valid, false, contact);
});
test('limits long messages while keeping text as plain data', () => {
  assert.equal(validateInquiry({ ...base, message: 'я'.repeat(3001) }).valid, false);
  assert.equal(validateInquiry({ ...base, message: '<script>test</script>' }).valid, true);
});
test('formats inquiry with optional message and no false delivery claim', () => {
  const labels = { heading: 'Обсудить лендинг', name: 'Имя', specialization: 'Практика', contact: 'Контакт', message: 'Задача' };
  const plain = formatInquiry(validateInquiry(base).values, labels);
  assert.match(plain, /Имя: Анна/);
  assert.doesNotMatch(plain, /Задача|отправлен/i);
  assert.ok(formatInquiry({ ...base, message: 'Нужен сайт\nс формой' }, labels).endsWith('Задача:\nНужен сайт\nс формой'));
});
