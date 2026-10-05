// Tests the class-wise viva/practical CSV import in the admin Exams page.
//
// The parser under test is not copied here: this extracts parseClasswiseCsv()
// and normalizeImportDate() straight out of +page.svelte at run time, so a
// regression in the shipped code fails this test.
//
//   node scripts/test-classwise-import.mjs
//   node scripts/test-classwise-import.mjs "path/to/schedule.csv"   # + real file
import { readFileSync, writeFileSync, rmSync } from 'node:fs';

const PAGE = 'src/routes/(dashboard)/admin/exams/+page.svelte';
const REAL_CSV = process.argv[2];

const src = readFileSync(PAGE, 'utf8');
const start = src.indexOf('  function normalizeImportDate(raw: string)');
const end = src.indexOf('  function resetClasswiseImport()');
if (start < 0 || end < 0 || end <= start) {
  console.error('FAIL: could not locate the parser functions in the page source');
  process.exit(1);
}

// Node strips types from .ts by default (v23.6+); the extracted source is TS.
const modPath = new URL('./.extracted-parser.ts', import.meta.url);
writeFileSync(
  modPath,
  src
    .slice(start, end)
    .replace(/^  /gm, '') + '\nexport { parseClasswiseCsv, normalizeImportDate };\n'
);

const { parseClasswiseCsv, normalizeImportDate } = await import(modPath.href);

let failures = 0;
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${actual}${ok ? '' : ` (expected ${expected})`}`);
};
const rejects = (label, text) => {
  try {
    parseClasswiseCsv(text);
    console.log(`  FAIL ${label}: no error thrown`);
    failures++;
  } catch (err) {
    console.log(`  ok   ${label}: ${String(err.message).slice(0, 64)}`);
  }
};

try {
  console.log('date normalisation');
  check('ISO passes through', normalizeImportDate('2026-10-05'), '2026-10-05');
  check('DD.MM.YYYY -> ISO', normalizeImportDate('05.10.2026'), '2026-10-05');
  check('DD/MM/YYYY -> ISO', normalizeImportDate('05/10/2026'), '2026-10-05');
  check('unparseable -> empty', normalizeImportDate('soon'), '');

  console.log('\nfixture (synthetic sheet)');
  const fixture =
    'Date,Division,Subject Name,Subject Code,Classroom\n' +
    '05.10.2026,7A1,Project II,303105423,172-C1\n' +
    '05.10.2026,7A2,INS,303105376,172-C2\n' +
    '05.10.2026,7A3,DS,303105394,172-C3\n' +
    '05.10.2026,7A4,Project II,303105423,172-C8\n' + // same slot -> merges
    '06.10.2026,7A1,INS,303105376,172-C1\n' +
    '06.10.2026,7A2,-,-,-\n' + // '-' means no exam, not a subject named '-'
    '2026-10-07,7A1,CS,303105342,172-C8\n';
  const fx = parseClasswiseCsv(fixture);

  check('merged same date/subject/code', fx.entries.length, 5);
  check('dates normalised to ISO', [...new Set(fx.entries.map((e) => e.date))].sort().join(','),
    '2026-10-05,2026-10-06,2026-10-07');
  check('no "-" subjects leak through',
    fx.entries.some((e) => e.subject === '-' || e.code === '-'), false);
  check('duplicate slot keeps both divisions',
    fx.entries.find((e) => e.subject === 'Project II')?.divisions.join('+'), '7A1+7A4');
  check('duplicate slot keeps both rooms',
    fx.entries.find((e) => e.subject === 'Project II')?.rooms.join('+'), '172-C1+172-C8');
  check('divisions counted', fx.entries.reduce((n, e) => n + e.divisions.length, 0), 6);
  check('nothing skipped', fx.skipped, 0);

  console.log('\nmalformed input');
  rejects('missing Division', 'Date,Subject Name,Subject Code,Classroom\n1,2,3,4');
  rejects('missing Date', 'Division,Subject Name,Subject Code,Classroom\n1,2,3,4');
  rejects('unrelated header', 'Name,Marks\nAlice,90');
  rejects('empty file', '   ');
  check('short line dropped + counted',
    parseClasswiseCsv(
      'Date,Division,Subject Name,Subject Code,Classroom\n' +
      '2026-10-05,7A1,INS,303105376,172-C1\n' +
      '2026-10-06,7A1\n'
    ).skipped, 1);

  if (REAL_CSV) {
    console.log(`\nreal file: ${REAL_CSV}`);
    const { entries, skipped } = parseClasswiseCsv(readFileSync(REAL_CSV, 'utf8'));

    check('rows skipped', skipped, 0);
    check('all dates ISO', entries.every((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date)), true);
    check('no blank subjects', entries.every((e) => e.subject && e.subject !== '-'), true);
    check('every entry has a room', entries.every((e) => e.rooms.length > 0), true);
    check('sorted ascending by date',
      JSON.stringify(entries.map((e) => e.date)) ===
        JSON.stringify([...entries.map((e) => e.date)].sort()), true);
    // Every raw row must contribute exactly one division, or data was lost.
    check('divisions covered', entries.reduce((n, e) => n + e.divisions.length, 0), 187);
    check('distinct date/subject/code entries', entries.length, 101);
    check('distinct dates', new Set(entries.map((e) => e.date)).size, 10);
  } else {
    console.log('\n(no real CSV given — pass a path to also check a real file)');
  }

  console.log(`\n${failures === 0 ? 'PASS' : `FAIL (${failures})`}`);
} finally {
  rmSync(modPath, { force: true });
}

process.exit(failures === 0 ? 0 : 1);
