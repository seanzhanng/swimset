import { Router, Request, Response } from 'express';
import { interpretShorthand } from '../core/dsl/interpreter';
import { InterpretedWorkout } from '../core/models/WorkoutTypes';

const router = Router();

interface InterpretRequestBody {
  shorthand: string;
}

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
    console.error('Error interpreting shorthand:', err);
    return res.status(500).json({
      error: 'Failed to interpret shorthand workout.'
    });
  }
});

export default router;