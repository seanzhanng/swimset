/**
 * Utilities for parsing time strings used in swim sets.
 *
 * Examples of supported formats:
 *   "1:40"  -> 100 seconds
 *   "0:45"  -> 45 seconds
 *   "45"    -> 45 seconds
 *   "2:00"  -> 120 seconds
 *
 * We keep this intentionally simple for v1 and only support:
 *   - MM:SS
 *   - M:SS
 *   - SS
 */

/**
 * Parse a time string (e.g., "1:40") into a number of seconds.
 *
 * @param input Raw time string from the DSL.
 * @returns Number of seconds, or undefined if the value is invalid.
 */
export function parseTimeToSeconds(input: string | undefined | null): number | undefined {
  if (!input) return undefined;

  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return undefined;
  }

  // Case 1: MM:SS or M:SS (contains a colon)
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');

    if (parts.length !== 2) {
      // e.g. "1:2:3" – not supported
      return undefined;
    }

    const [minutesPart, secondsPart] = parts;

    const minutes = Number.parseInt(minutesPart, 10);
    const seconds = Number.parseInt(secondsPart, 10);

    if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || minutes < 0 || seconds < 0 || seconds >= 60) {
      return undefined;
    }

    return minutes * 60 + seconds;
  }

  // Case 2: plain seconds ("45", "100", etc.)
  const asSeconds = Number.parseInt(trimmed, 10);

  if (!Number.isFinite(asSeconds) || asSeconds < 0) {
    return undefined;
  }

  return asSeconds;
}

/**
 * Format a number of seconds back into a "M:SS" string.
 * Not strictly required for the interpreter, but useful for
 * logging, debugging, or UI display.
 *
 * Example:
 *   100 -> "1:40"
 *   45  -> "0:45"
 */
export function formatSecondsAsTime(totalSeconds: number | undefined): string | undefined {
  if (totalSeconds === undefined) return undefined;
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return undefined;

  const wholeSeconds = Math.round(totalSeconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const seconds = wholeSeconds % 60;

  const secondsPadded = seconds.toString().padStart(2, '0');
  return `${minutes}:${secondsPadded}`;
}
