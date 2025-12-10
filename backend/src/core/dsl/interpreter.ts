import {
  InterpretedWorkout,
  ParseError,
  SectionName,
  SetInterval,
  WorkoutHeader,
  WorkoutTotals
} from '../models/WorkoutTypes';
import { parseTimeToSeconds } from './parseTime';

const SET_LINE_REGEX =
  /^(?:(\d+)x)?(\d+)\s+(\S+)(?:\s+@(\S+))?(?:\s+(\S+))?$/;

export function interpretShorthand(text: string): InterpretedWorkout {
  const header: WorkoutHeader = {};
  const sets: SetInterval[] = [];
  const errors: ParseError[] = [];
  const warnings: string[] = [];

  let currentSection: SectionName = 'main';

  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const rawLine = lines[index];
    const trimmed = rawLine.trim();

    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      continue;
    }

    if (trimmed.endsWith(':')) {
      const sectionName = trimmed.slice(0, -1).trim().toLowerCase();
      if (sectionName.length === 0) {
        errors.push({
          lineNumber,
          message: 'Empty section name.'
        });
        continue;
      }
      currentSection = sectionName as SectionName;
      continue;
    }

    if (handleHeaderLine(trimmed, header, lineNumber, errors)) {
      continue;
    }

    const set = parseSetLine(trimmed, currentSection, lineNumber, errors);
    if (set) {
      sets.push({
        ...set,
        raw: rawLine,
        lineNumber
      });
    }
  }

  const totals = computeTotals(sets);
  const estimatedMinutes = estimateDurationMinutes(sets, totals.totalDistanceMeters);

  if (estimatedMinutes !== undefined) {
    totals.estimatedMinutes = estimatedMinutes;
  }

  if (header.plannedDurationMinutes !== undefined && totals.estimatedMinutes !== undefined) {
    const diff = totals.estimatedMinutes - header.plannedDurationMinutes;
    const absDiff = Math.abs(diff);

    if (absDiff > 10) {
      if (diff > 0) {
        warnings.push(
          `Estimated duration (~${totals.estimatedMinutes.toFixed(
            1
          )} min) exceeds planned duration (${header.plannedDurationMinutes} min) by about ${absDiff.toFixed(
            1
          )} min.`
        );
      } else {
        warnings.push(
          `Estimated duration (~${totals.estimatedMinutes.toFixed(
            1
          )} min) is significantly shorter than planned duration (${header.plannedDurationMinutes} min) by about ${absDiff.toFixed(
            1
          )} min.`
        );
      }
    }
  }

  return {
    header,
    sets,
    totals,
    errors,
    warnings
  };
}

function handleHeaderLine(
  trimmedLine: string,
  header: WorkoutHeader,
  lineNumber: number,
  errors: ParseError[]
): boolean {
  const [firstToken, ...restTokens] = trimmedLine.split(/\s+/);
  if (!firstToken) {
    return false;
  }

  const key = firstToken.toLowerCase();
  const restJoined = restTokens.join(' ');

  switch (key) {
    case 'pool': {
      const meters = extractInteger(restJoined || firstToken);
      if (meters !== undefined) {
        header.poolLengthMeters = meters;
      } else {
        errors.push({
          lineNumber,
          message: `Unable to parse pool length from "${trimmedLine}".`
        });
      }
      return true;
    }

    case 'duration': {
      const minutes = extractInteger(restJoined);
      if (minutes !== undefined) {
        header.plannedDurationMinutes = minutes;
      } else {
        errors.push({
          lineNumber,
          message: `Unable to parse duration from "${trimmedLine}".`
        });
      }
      return true;
    }

    case 'title': {
      header.title = restJoined || '';
      return true;
    }

    case 'focus': {
      header.focus = restJoined || '';
      return true;
    }

    case 'profile': {
      header.profile = restJoined || '';
      return true;
    }

    default:
      return false;
  }
}

function extractInteger(source: string | undefined): number | undefined {
  if (!source) return undefined;
  const match = source.match(/(\d+)/);
  if (!match) return undefined;

  const value = Number.parseInt(match[1], 10);
  if (!Number.isFinite(value)) return undefined;
  return value;
}

function parseSetLine(
  trimmedLine: string,
  currentSection: SectionName,
  lineNumber: number,
  errors: ParseError[]
): Omit<SetInterval, 'raw' | 'lineNumber'> | null {
  const match = trimmedLine.match(SET_LINE_REGEX);

  if (!match) {
    errors.push({
      lineNumber,
      message: 'Unrecognized set syntax.'
    });
    return null;
  }

  const [, repsStr, distanceStr, strokeToken, timeToken, intensityToken] = match;

  const reps = repsStr ? Number.parseInt(repsStr, 10) : 1;
  const distanceMeters = Number.parseInt(distanceStr, 10);
  const stroke = strokeToken;
  const intensity = intensityToken;

  if (!Number.isFinite(reps) || reps <= 0) {
    errors.push({
      lineNumber,
      message: `Invalid reps value "${repsStr ?? ''}".`
    });
  }

  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) {
    errors.push({
      lineNumber,
      message: `Invalid distance value "${distanceStr}".`
    });
  }

  let sendOffSeconds: number | undefined;
  if (timeToken) {
    const parsedSeconds = parseTimeToSeconds(timeToken);
    if (parsedSeconds === undefined) {
      errors.push({
        lineNumber,
        message: `Invalid time format "${timeToken}". Expected formats like "1:40" or "45".`
      });
    } else {
      sendOffSeconds = parsedSeconds;
    }
  }

  return {
    section: currentSection,
    reps: Number.isFinite(reps) && reps > 0 ? reps : 0,
    distanceMeters: Number.isFinite(distanceMeters) && distanceMeters > 0 ? distanceMeters : 0,
    stroke,
    sendOffSeconds,
    intensity
  };
}

function computeTotals(sets: SetInterval[]): WorkoutTotals {
  let totalDistanceMeters = 0;
  const distanceBySection: Record<SectionName, number> = {} as Record<SectionName, number>;
  const distanceByIntensity: Record<string, number> = {};

  for (const set of sets) {
    const distanceForSet = set.reps * set.distanceMeters;

    totalDistanceMeters += distanceForSet;

    const sectionKey = set.section;
    distanceBySection[sectionKey] = (distanceBySection[sectionKey] ?? 0) + distanceForSet;

    const intensityKey = set.intensity ?? 'unknown';
    distanceByIntensity[intensityKey] = (distanceByIntensity[intensityKey] ?? 0) + distanceForSet;
  }

  return {
    totalDistanceMeters,
    distanceBySection,
    distanceByIntensity,
    estimatedMinutes: undefined
  };
}

function estimateDurationMinutes(sets: SetInterval[], totalDistanceMeters: number): number | undefined {
  if (sets.length === 0) {
    return undefined;
  }

  const setsWithSendOff = sets.filter((s) => s.sendOffSeconds !== undefined);

  if (setsWithSendOff.length >= sets.length / 2) {
    let totalSeconds = 0;
    for (const set of setsWithSendOff) {
      if (set.sendOffSeconds !== undefined) {
        totalSeconds += set.reps * set.sendOffSeconds;
      }
    }
    return totalSeconds / 60;
  }

  if (totalDistanceMeters <= 0) {
    return undefined;
  }

  const defaultPaceSecondsPer100 = 90;
  const totalSeconds = (totalDistanceMeters / 100) * defaultPaceSecondsPer100;
  return totalSeconds / 60;
}