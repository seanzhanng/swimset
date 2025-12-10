export function parseTimeToSeconds(input: string | undefined | null): number | undefined {
  if (!input) return undefined;

  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return undefined;
  }

  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');

    if (parts.length !== 2) {
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

  const asSeconds = Number.parseInt(trimmed, 10);

  if (!Number.isFinite(asSeconds) || asSeconds < 0) {
    return undefined;
  }

  return asSeconds;
}

export function formatSecondsAsTime(totalSeconds: number | undefined): string | undefined {
  if (totalSeconds === undefined) return undefined;
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return undefined;

  const wholeSeconds = Math.round(totalSeconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const seconds = wholeSeconds % 60;

  const secondsPadded = seconds.toString().padStart(2, '0');
  return `${minutes}:${secondsPadded}`;
}
