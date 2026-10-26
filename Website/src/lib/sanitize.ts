/** Input sanitization. React escapes output; this additionally normalizes stored text. */
export function sanitizeText(input: unknown, max = 500): string {
  if (typeof input !== 'string') return '';
  return input
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, max);
}

let counter = 0;
export function uid(prefix = 'id'): string {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}${rand}`;
}
