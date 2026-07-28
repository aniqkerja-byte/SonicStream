const test = require('node:test');
const assert = require('node:assert/strict');

function parseRange(range, fileSize) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!match) return null;
  const isSuffixRange = !match[1] && match[2];
  const start = isSuffixRange ? Math.max(fileSize - Number(match[2]), 0) : Number(match[1]);
  const requestedEnd = isSuffixRange || !match[2] ? fileSize - 1 : Number(match[2]);
  if (!Number.isInteger(start) || !Number.isInteger(requestedEnd) || start < 0 || requestedEnd < 0 || start > requestedEnd || start >= fileSize) return null;
  return { start, end: Math.min(requestedEnd, fileSize - 1) };
}

test('parses suffix byte ranges', () => {
  assert.deepEqual(parseRange('bytes=-500', 1000), { start: 500, end: 999 });
});

test('clamps open-ended byte ranges', () => {
  assert.deepEqual(parseRange('bytes=900-', 1000), { start: 900, end: 999 });
});

test('rejects invalid byte ranges', () => {
  assert.equal(parseRange('bytes=1000-1001', 1000), null);
  assert.equal(parseRange('bytes=900-100', 1000), null);
});
