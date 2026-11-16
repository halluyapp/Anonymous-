import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrapText } from '../apps/web/lib/wrap.mjs';
const measure = value => [...value].length;
test('preserves paragraphs, blank lines and leading whitespace', () => {
  assert.deepEqual(wrapText('First\n\n  Next', 100, measure), ['First', '', '  Next']);
});
test('preserves every character of long lines including emoji', () => {
  const text = 'hello 😀 世界 '.repeat(100);
  const result = wrapText(text, 10, measure);
  assert.equal(result.join(''), text);
  assert.ok(result.every(line => measure(line) <= 10));
});
test('normalizes CRLF but preserves line breaks', () => {
  assert.deepEqual(wrapText('one\r\ntwo', 10, measure), ['one', 'two']);
});
