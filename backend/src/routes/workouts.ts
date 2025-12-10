import { Router, Request, Response } from 'express';
import { interpretShorthand } from '../core/dsl/interpreter';
import {
  createWorkout,
  getWorkoutById,
  listWorkouts,
  deleteWorkoutById,
  updateWorkoutById,
  WorkoutRow
} from '../db/workoutRepo';

const router = Router();

/**
 * POST /workouts
 * Body: { title?, shorthand, poolLengthMeters?, plannedDurationMinutes?, focus?, profile? }
 *
 * - Interprets the shorthand
 * - Computes total distance
 * - Saves to DB
 * - Returns { workout, interpreted }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      title,
      shorthand,
      poolLengthMeters,
      plannedDurationMinutes,
      focus,
      profile
    } = req.body as {
      title?: string;
      shorthand?: string;
      poolLengthMeters?: number;
      plannedDurationMinutes?: number;
      focus?: string;
      profile?: string;
    };

    if (!shorthand || typeof shorthand !== 'string') {
      return res.status(400).json({ error: 'shorthand is required and must be a string.' });
    }

    const interpreted = interpretShorthand(shorthand);
    const totalDistanceMeters = interpreted.totals.totalDistanceMeters;

    const workout = await createWorkout({
      title,
      poolLengthMeters,
      plannedDurationMinutes,
      focus,
      profile,
      shorthand,
      totalDistanceMeters
    });

    return res.status(201).json({ workout, interpreted });
  } catch (err) {
    console.error('Error creating workout:', err);
    return res.status(500).json({ error: 'Failed to create workout.' });
  }
});

/**
 * GET /workouts
 * Returns: { workouts: WorkoutRow[] }
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const workouts: WorkoutRow[] = await listWorkouts();
    return res.json({ workouts });
  } catch (err) {
    console.error('Error listing workouts:', err);
    return res.status(500).json({ error: 'Failed to list workouts.' });
  }
});

/**
 * GET /workouts/:id
 * Returns: { workout, interpreted }
 */
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const workout = await getWorkoutById(id);

    if (!workout) {
      return res.status(404).json({ error: 'Workout not found.' });
    }

    const interpreted = interpretShorthand(workout.shorthand);
    return res.json({ workout, interpreted });
  } catch (err) {
    console.error('Error fetching workout:', err);
    return res.status(500).json({ error: 'Failed to fetch workout.' });
  }
});

/**
 * PUT /workouts/:id
 * Body: { title?, shorthand, poolLengthMeters?, plannedDurationMinutes?, focus?, profile? }
 *
 * - Re-interprets shorthand
 * - Updates DB row
 * - Returns { workout, interpreted }
 */
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const {
      title,
      shorthand,
      poolLengthMeters,
      plannedDurationMinutes,
      focus,
      profile
    } = req.body as {
      title?: string;
      shorthand?: string;
      poolLengthMeters?: number;
      plannedDurationMinutes?: number;
      focus?: string;
      profile?: string;
    };

    if (!shorthand || typeof shorthand !== 'string') {
      return res.status(400).json({ error: 'shorthand is required and must be a string.' });
    }

    const interpreted = interpretShorthand(shorthand);
    const totalDistanceMeters = interpreted.totals.totalDistanceMeters;

    const updated = await updateWorkoutById(id, {
      title,
      poolLengthMeters,
      plannedDurationMinutes,
      focus,
      profile,
      shorthand,
      totalDistanceMeters
    });

    if (!updated) {
      return res.status(404).json({ error: 'Workout not found.' });
    }

    return res.json({ workout: updated, interpreted });
  } catch (err) {
    console.error('Error updating workout:', err);
    return res.status(500).json({ error: 'Failed to update workout.' });
  }
});

/**
 * DELETE /workouts/:id
 * - Deletes a workout
 * - 204 if deleted
 * - 404 if not found
 */
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const deleted = await deleteWorkoutById(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Workout not found.' });
    }

    return res.status(204).send();
  } catch (err) {
    console.error('Error deleting workout:', err);
    return res.status(500).json({ error: 'Failed to delete workout.' });
  }
});

export default router;
