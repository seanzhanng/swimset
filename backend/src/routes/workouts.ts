import { Router, Request, Response } from 'express';
import { interpretShorthand } from '../core/dsl/interpreter';
import { InterpretedWorkout } from '../core/models/WorkoutTypes';
import {
  createWorkout,
  getWorkoutById,
  listWorkouts,
  CreateWorkoutInput,
  WorkoutRecord
} from '../db/workoutRepo';

const router = Router();

interface CreateWorkoutRequestBody {
  title?: string;
  shorthand: string;
  poolLengthMeters?: number;
  plannedDurationMinutes?: number;
  focus?: string;
  profile?: string;
}

/**
 * POST /workouts
 *
 * Creates a new workout from raw shorthand DSL and optional metadata.
 *
 * Request body:
 *   {
 *     "title": "Threshold Tuesday",
 *     "shorthand": "pool 25m\nwarmup:\n  200 FR easy\n  4x50 drill @1:00\nmain:\n  10x100 FR @1:40 thresh\ncooldown:\n  100 choice easy\n",
 *     "poolLengthMeters": 25,
 *     "plannedDurationMinutes": 90,
 *     "focus": "threshold",
 *     "profile": "intermediate"
 *   }
 *
 * Response:
 *   {
 *     "workout": WorkoutRecord,
 *     "interpreted": InterpretedWorkout
 *   }
 */
router.post('/', async (req: Request<unknown, unknown, CreateWorkoutRequestBody>, res: Response) => {
  const { title, shorthand, poolLengthMeters, plannedDurationMinutes, focus, profile } = req.body || {};

  if (typeof shorthand !== 'string' || shorthand.trim().length === 0) {
    return res.status(400).json({
      error: 'Invalid "shorthand". Expected non-empty string.'
    });
  }

  if (
    poolLengthMeters !== undefined &&
    (typeof poolLengthMeters !== 'number' || !Number.isFinite(poolLengthMeters) || poolLengthMeters <= 0)
  ) {
    return res.status(400).json({
      error: 'Invalid "poolLengthMeters". If provided, must be a positive number.'
    });
  }

  if (
    plannedDurationMinutes !== undefined &&
    (typeof plannedDurationMinutes !== 'number' ||
      !Number.isFinite(plannedDurationMinutes) ||
      plannedDurationMinutes <= 0)
  ) {
    return res.status(400).json({
      error: 'Invalid "plannedDurationMinutes". If provided, must be a positive number.'
    });
  }

  try {
    // Interpret to compute totals and validate DSL
    const interpreted: InterpretedWorkout = interpretShorthand(shorthand);

    const createInput: CreateWorkoutInput = {
      title,
      shorthand,
      poolLengthMeters,
      plannedDurationMinutes,
      focus,
      profile,
      totalDistanceMeters: interpreted.totals.totalDistanceMeters
    };

    const workout: WorkoutRecord = await createWorkout(createInput);

    return res.status(201).json({
      workout,
      interpreted
    });
  } catch (err) {
    console.error('Error creating workout:', err);
    return res.status(500).json({
      error: 'Failed to create workout.'
    });
  }
});

/**
 * GET /workouts
 *
 * List recent workouts (metadata only, no interpretation).
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const workouts = await listWorkouts(50);
    return res.status(200).json({ workouts });
  } catch (err) {
    console.error('Error listing workouts:', err);
    return res.status(500).json({
      error: 'Failed to list workouts.'
    });
  }
});

/**
 * GET /workouts/:id
 *
 * Fetch a single workout and return both the saved record and
 * the interpreted structure.
 */
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const workout = await getWorkoutById(id);

    if (!workout) {
      return res.status(404).json({ error: 'Workout not found.' });
    }

    const interpreted: InterpretedWorkout = interpretShorthand(workout.shorthand);

    return res.status(200).json({
      workout,
      interpreted
    });
  } catch (err) {
    console.error('Error fetching workout by ID:', err);
    return res.status(500).json({
      error: 'Failed to fetch workout.'
    });
  }
});

export default router;
