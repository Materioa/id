/**
 * Materio Input Sanitation and Normalization
 * Protects forms and layouts against breaking ASCII / Unicode attacks (Zalgo, BiDi overrides, control chars),
 * and provides normalization for names, usernames, and other form fields.
 */

// Characters that disrupt layout, direction, or terminal/browser rendering
const CONTROL_AND_INVISIBLES = /[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF\u00AD\u2060]/g;
const BIDI_OVERRIDES = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
const REPEATED_COMBINING_MARKS = /\p{M}{2,}/gu;
const ALL_COMBINING_MARKS = /\p{M}/gu;
const EMOJI_REGEX = /(\p{Extended_Pictographic}|\p{Emoji_Presentation})/u;

/**
 * Strips layout-breaking characters (control chars, BiDi overrides, zero-width spaces, and stacked combining marks / Zalgo)
 */
export function stripLayoutBreakingChars(input) {
  if (typeof input !== 'string') return '';
  return input
    .normalize('NFC')
    .replace(CONTROL_AND_INVISIBLES, '')
    .replace(BIDI_OVERRIDES, '')
    .replace(REPEATED_COMBINING_MARKS, '');
}

/**
 * Checks whether an input contains layout-breaking characters (Zalgo / combining mark flood / BiDi / control chars)
 */
export function hasLayoutBreakingChars(input) {
  if (typeof input !== 'string') return false;
  return (
    CONTROL_AND_INVISIBLES.test(input) ||
    BIDI_OVERRIDES.test(input) ||
    REPEATED_COMBINING_MARKS.test(input)
  );
}

/**
 * Formats a single word to Title Case (First letter capitalized, remaining small)
 */
function titleCaseWord(word) {
  if (!word) return '';
  if (word.includes('-')) {
    return word
      .split('-')
      .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : ''))
      .join('-');
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Normalizes a display name:
 * - Strips layout-breaking characters
 * - Only first letter capital, rest small (Title Case)
 * - Drops middle names (keeps first and last name if >2 words)
 */
export function normalizeName(rawName) {
  if (typeof rawName !== 'string') return '';
  const clean = stripLayoutBreakingChars(rawName).trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return titleCaseWord(words[0]);
  if (words.length === 2) return `${titleCaseWord(words[0])} ${titleCaseWord(words[1])}`;
  // Drop middle names: keep only first and last name
  return `${titleCaseWord(words[0])} ${titleCaseWord(words[words.length - 1])}`;
}

/**
 * Validates a display name according to Materio rules:
 * - Cannot be all capitals
 * - No numbers
 * - No emojis
 * - No layout breaking characters / Zalgo
 * - No illegal symbols
 */
export function validateName(name) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    return { valid: false, error: 'Name is required' };
  }

  const trimmed = name.trim();

  if (hasLayoutBreakingChars(trimmed)) {
    return { valid: false, error: 'Name contains invalid or layout-breaking characters' };
  }

  if (EMOJI_REGEX.test(trimmed)) {
    return { valid: false, error: 'Name cannot contain emojis' };
  }

  if (/\d/.test(trimmed)) {
    return { valid: false, error: 'Name cannot contain numbers' };
  }

  if (/[/\\#@$%^&*+=_~<>{}[\]|`"!]/.test(trimmed)) {
    return { valid: false, error: 'Name cannot contain special symbols' };
  }

  // Letters check (supporting international letters \p{L})
  const lettersOnly = trimmed.replace(/[^\p{L}]/gu, '');
  if (lettersOnly.length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters' };
  }

  // Cannot be all capital letters
  if (lettersOnly.length >= 2 && lettersOnly === lettersOnly.toUpperCase() && /[A-Z]/.test(lettersOnly)) {
    return { valid: false, error: 'Name cannot be in ALL CAPS. First letter capital, rest small.' };
  }

  return { valid: true };
}

/**
 * Normalizes username:
 * - Strips layout breaking characters and all combining marks
 * - Lowers case
 * - Trims whitespace
 */
export function normalizeUsername(rawUsername) {
  if (typeof rawUsername !== 'string') return '';
  return stripLayoutBreakingChars(rawUsername)
    .replace(ALL_COMBINING_MARKS, '')
    .toLowerCase()
    .trim();
}

/**
 * Validates username according to Materio rules:
 * - Cannot be in capital (all small)
 * - Cannot contain spaces
 * - Cannot contain emojis
 * - Cannot contain breaking ascii / zalgo
 * - Can only contain lowercase letters (including other languages if not breaking layout), numbers, '.', '_', and '-'
 * - Cannot contain '/' or '#'
 */
export function validateUsername(username) {
  if (!username || typeof username !== 'string' || !username.trim()) {
    return { valid: false, error: 'Username is required' };
  }

  if (/\s/.test(username)) {
    return { valid: false, error: 'Username cannot contain spaces' };
  }

  if (hasLayoutBreakingChars(username) || ALL_COMBINING_MARKS.test(username)) {
    return { valid: false, error: 'Username contains invalid or layout-breaking characters' };
  }

  if (EMOJI_REGEX.test(username)) {
    return { valid: false, error: 'Username cannot contain emojis' };
  }

  if (/[A-Z]|\p{Lu}/u.test(username)) {
    return { valid: false, error: 'Username cannot contain capital letters (use all lowercase)' };
  }

  if (username.includes('/') || username.includes('#')) {
    return { valid: false, error: "Username cannot contain '/' or '#'" };
  }

  if (username.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' };
  }

  if (username.length > 30) {
    return { valid: false, error: 'Username cannot exceed 30 characters' };
  }

  // Only lowercase letters in any language (\p{Ll}, \p{Lo}), digits 0-9, '.', '_', and '-'
  const validPattern = /^[\p{Ll}\p{Lo}0-9._-]+$/u;
  if (!validPattern.test(username.normalize('NFC'))) {
    return { valid: false, error: "Only lowercase letters, numbers, '.', '_', and '-' are allowed" };
  }

  return { valid: true };
}

/**
 * Generic field sanitizer for all other inputs (email, passoutYear, text)
 */
export function sanitizeField(value) {
  if (typeof value !== 'string') return value;
  return stripLayoutBreakingChars(value).trim();
}
