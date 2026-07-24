// Keeping identifiable details off the wire when we call the AI provider.
//
// The AI features work on the *substance* of a record — where the deal stands,
// what the notes say — not on who the person is. Sending real names, emails and
// phone numbers to an overseas provider is a cross-border disclosure of personal
// information (Australian Privacy Principle 8) that buys us nothing.
//
// So we swap those values for stable tokens on the way out, and swap them back
// on the way in. The model sees "[CONTACT_1] is ready to proceed"; the broker
// still reads "Jordan Reyes is ready to proceed". Nothing downstream changes.

export type Redaction = {
  /** Replace real values with tokens before the text leaves our servers. */
  redact: (text: string) => string;
  /** Put the real values back into whatever the model returned. */
  restore: (text: string) => string;
};

export type RedactionEntry = { token: string; value: string | null | undefined };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Word-boundary matching is right for names, wrong for phone numbers and emails. */
function isWordLike(value: string): boolean {
  return /^[\p{L}\p{N} '’-]+$/u.test(value);
}

const MIN_LENGTH = 3; // "Al" or "Jo" would match inside unrelated words.

/**
 * Build a redactor for one record's identifying values.
 *
 * Values are replaced longest-first so that a full name is tokenised before any
 * of its parts, and duplicates collapse onto the token already assigned.
 */
export function buildRedaction(entries: RedactionEntry[]): Redaction {
  const pairs: Array<{ token: string; value: string }> = [];
  const seen = new Map<string, string>();

  for (const { token, value } of entries) {
    const trimmed = value?.trim();
    if (!trimmed || trimmed.length < MIN_LENGTH) continue;
    const key = trimmed.toLowerCase();
    const already = seen.get(key);
    if (already) continue; // same person twice — one token is enough
    seen.set(key, token);
    pairs.push({ token, value: trimmed });
  }

  pairs.sort((a, b) => b.value.length - a.value.length);

  return {
    redact(text: string): string {
      let out = text;
      for (const { token, value } of pairs) {
        const body = escapeRegExp(value);
        const pattern = isWordLike(value) ? `\\b${body}\\b` : body;
        out = out.replace(new RegExp(pattern, "gi"), token);
      }
      return out;
    },
    restore(text: string): string {
      let out = text;
      for (const { token, value } of pairs) {
        out = out.replace(new RegExp(escapeRegExp(token), "g"), value);
      }
      return out;
    },
  };
}

/** A redactor that does nothing — for records with no identifying values. */
export const NO_REDACTION: Redaction = {
  redact: (text) => text,
  restore: (text) => text,
};
