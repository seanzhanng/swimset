import { Router, Request, Response } from 'express';
import { interpretShorthand } from '../core/dsl/interpreter';
import { InterpretedWorkout } from '../core/models/WorkoutTypes';

const router = Router();

interface InterpretRequestBody {
  shorthand: string;
}

/**
 * POST /interpret
 *
 * Request body:
 *   {
 *     "shorthand": "warmup:\n  200 FR easy\n  4x50 drill @1:00\nmain:\n  10x100 FR @1:40 thresh\n"
 *   }
 *
 * Response:
 *   InterpretedWorkout JSON
 */
router.post('/', (req: Request<unknown, unknown, InterpretRequestBody>, res: Response) => {
  const { shorthand } = req.body || {};

  if (typeof shorthand !== 'string' || shorthand.trim().length === 0) {
    return res.status(400).json({
      error: 'Invalid request body. Expected non-empty "shorthand" field of type string.'
    });
  }

  try {
    const interpreted: InterpretedWorkout = interpretShorthand(shorthand);
    return res.status(200).json(interpreted);
  } catch (err) {
    // Let the global error handler deal with logging and response
    console.error('Error interpreting shorthand:', err);
    return res.status(500).json({
      error: 'Failed to interpret shorthand workout.'
    });
  }
});

export default router;