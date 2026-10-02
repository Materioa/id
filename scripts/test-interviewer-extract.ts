import {
  mergeExtracted,
  sanitiseValue,
  isMeaningfulValue,
  remainingFields,
  isSatisfied,
  extractFieldsRegex
} from '../packages/config/src/interviewer.js';

const form = {
  id: 'test',
  fields: [
    { name: 'question', label: 'Question', type: 'textarea', required: true },
    { name: 'subject', label: 'Subject or topic', type: 'text', required: true },
    { name: 'difficulty', label: 'Difficulty', type: 'select', options: ['Easy', 'Moderate', 'Challenging'] },
    { name: 'notes', label: 'Helpful notes', type: 'textarea', required: false }
  ]
};

let pass = 0;
let fail = 0;
function check(name: string, got: any, want: any) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}\n        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`); }
}

console.log('\n— empty / noise answers are rejected —');
for (const junk of ['n/a', 'N/A', 'none', 'unknown', 'not sure', "don't know", 'skip', 'ok', 'thanks', 'yeah', '-', '', '   ']) {
  check(`rejects ${JSON.stringify(junk)}`, isMeaningfulValue(junk), false);
}
check('accepts a real answer', isMeaningfulValue('Explain the difference between a stack and a queue'), true);
check('accepts a rating digit', isMeaningfulValue('4'), true);

console.log('\n— type coercion —');
check('select snaps to a declared option', sanitiseValue(form.fields[2], 'moder'), 'Moderate');
check('select rejects an unlisted value', sanitiseValue(form.fields[2], 'extremely difficult'), null);
check('rating clamps out-of-range', sanitiseValue({ ...form.fields[2], type: 'rating', max: 5 }, '9'), null);
check('rating takes a digit', sanitiseValue({ ...form.fields[2], type: 'rating', max: 5 }, 'out of 4'), '4');
check('strips markdown/quote wrappers', sanitiseValue(form.fields[0], '**Explain TCP**'), 'Explain TCP');
check('file fields are never captured in chat', sanitiseValue({ name: 'f', type: 'file' }, 'notes.pdf'), null);
check('email must look like an email', sanitiseValue({ name: 'e', type: 'email' }, 'not-an-email'), null);

console.log('\n— captured values are protected from noise —');
const afterFirst = mergeExtracted(form, {}, { subject: 'Operating Systems', question: 'Explain process vs thread' });
check('first pass captures both', afterFirst.extracted.subject, 'Operating Systems');

const noise = mergeExtracted(form, afterFirst.extracted, { subject: 'idk', question: 'n/a' });
check('noise does not overwrite a good value', noise.extracted.subject, 'Operating Systems');
check('nothing reported as added', noise.added, []);
check('nothing reported as updated', noise.updated, []);

const restated = mergeExtracted(form, afterFirst.extracted, { subject: 'operating systems' });
check('same value restated is a no-op', restated.extracted.subject, 'Operating Systems');

const corrected = mergeExtracted(form, afterFirst.extracted, { subject: 'Actually, it was Computer Networks' });
check('an explicit correction does apply', corrected.extracted.subject, 'Actually, it was Computer Networks');
check('correction is reported as updated', corrected.updated, ['subject']);

console.log('\n— unknown fields are dropped —');
check('unknown field rejected', mergeExtracted(form, {}, { hacker: 'x' }).rejected, ['hacker']);
check('unknown field not stored', mergeExtracted(form, {}, { hacker: 'x' }).extracted, {});

console.log('\n— progress + completion (required fields only) —');
check('optional fields are not tracked as outstanding', remainingFields(form, afterFirst.extracted, []).map((f: any) => f.name), []);
check('satisfied once the required ones are in', isSatisfied(form, afterFirst.extracted, []), true);

const partial = mergeExtracted(form, {}, { subject: 'Operating Systems' });
check('one required field still open', remainingFields(form, partial.extracted, []).map((f: any) => f.name), ['question']);
check('not satisfied yet', isSatisfied(form, partial.extracted, []), false);
check('skipping the last one satisfies it', isSatisfied(form, partial.extracted, ['question']), true);

console.log('\n— regex fallback does not overwrite —');
const known = { question: 'Explain process vs thread' };
const fallback = extractFieldsRegex('I have no idea about this one', form.fields, known);
check('regex leaves known fields alone', fallback.question, undefined);
check('regex still fills an open field', fallback.subject !== undefined, true);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);