import { Router, Request, Response } from 'express';
import { listWorkouts } from '../db/workoutRepo';

const router = Router();

router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const workouts = await listWorkouts();

    const now = new Date();
    const millisInDay = 24 * 60 * 60 * 1000;
    const sevenDaysAgo = new Date(now.getTime() - 7 * millisInDay);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * millisInDay);

    let totalDistance = 0;
    let distanceLast7 = 0;
    let distanceLast30 = 0;

    const distanceByFocus: Record<string, number> = {};
    const distanceByProfile: Record<string, number> = {};

    for (const w of workouts) {
      const dist = w.totalDistanceMeters ?? 0;
      totalDistance += dist;

      const created = w.createdAt;

      if (created >= sevenDaysAgo) {
        distanceLast7 += dist;
      }
      if (created >= thirtyDaysAgo) {
        distanceLast30 += dist;
      }

      const focusKey = w.focus ?? 'unknown';
      distanceByFocus[focusKey] = (distanceByFocus[focusKey] || 0) + dist;

      const profileKey = w.profile ?? 'unknown';
      distanceByProfile[profileKey] =
        (distanceByProfile[profileKey] || 0) + dist;
    }

    const summary = {
      totalDistanceMeters: totalDistance,
      workoutCount: workouts.length,
      distanceByFocus,
      distanceByProfile,
      distanceLast7Days: distanceLast7,
      distanceLast30Days: distanceLast30
    };

    return res.json(summary);
  } catch (err) {
    console.error('Error generating stats summary:', err);
    return res
      .status(500)
      .json({ error: 'Failed to load stats summary.' });
  }
});

export default router;
