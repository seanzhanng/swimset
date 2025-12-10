import { Router, Request, Response } from 'express';
import { generateWorkoutDSL } from '../core/generator/generator';
import { GenerateConstraints, InterpretedWorkout } from '../core/models/WorkoutTypes';
import { interpretShorthand } from '../core/dsl/interpreter';

const router = Router();

type GenerateRequestBody = GenerateConstraints;

const VALID_FOCUS: GenerateConstraints['focus'][] = ['aerobic', 'threshold', 'sprint', 'technique'];
const VALID_PROFILE: GenerateConstraints['profile'][] = ['novice', 'intermediate', 'elite'];

router.post('/', (req: Request<unknown, unknown, GenerateRequestBody>, res: Response) => {
  const body = req.body;

  if (
    !body ||
    typeof body.poolLengthMeters !== 'number' ||
    !Number.isFinite(body.poolLengthMeters) ||
    body.poolLengthMeters <= 0
  ) {
    return res.status(400).json({
      error: 'Invalid "poolLengthMeters". Expected a positive number (e.g., 25 or 50).'
    });
  }

  if (typeof body.focus !== 'string' || !VALID_FOCUS.includes(body.focus)) {
    return res.status(400).json({
      error: `Invalid "focus". Expected one of: ${VALID_FOCUS.join(', ')}.`
    });
  }

  if (typeof body.profile !== 'string' || !VALID_PROFILE.includes(body.profile)) {
    return res.status(400).json({
      error: `Invalid "profile". Expected one of: ${VALID_PROFILE.join(', ')}.`
    });
  }

  if (
    body.targetDistanceMeters !== undefined &&
    (typeof body.targetDistanceMeters !== 'number' ||
      !Number.isFinite(body.targetDistanceMeters) ||
      body.targetDistanceMeters <= 0)
  ) {
    return res.status(400).json({
      error: 'Invalid "targetDistanceMeters". If provided, it must be a positive number.'
    });
  }

  if (
    body.targetDurationMinutes !== undefined &&
    (typeof body.targetDurationMinutes !== 'number' ||
      !Number.isFinite(body.targetDurationMinutes) ||
      body.targetDurationMinutes <= 0)
  ) {
    return res.status(400).json({
      error: 'Invalid "targetDurationMinutes". If provided, it must be a positive number.'
    });
  }

  try {
    const constraints: GenerateConstraints = {
      poolLengthMeters: body.poolLengthMeters,
      targetDistanceMeters: body.targetDistanceMeters,
      targetDurationMinutes: body.targetDurationMinutes,
      focus: body.focus,
      profile: body.profile,
      title: body.title
    };

    const dsl = generateWorkoutDSL(constraints);
    const interpreted: InterpretedWorkout = interpretShorthand(dsl);

    return res.status(200).json({
      dsl,
      interpreted
    });
  } catch (err) {
    console.error('Error generating workout:', err);
    return res.status(500).json({
      error: 'Failed to generate workout.'
    });
  }
});

export default router;
