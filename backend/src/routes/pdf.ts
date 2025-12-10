import { Router, Request, Response } from 'express';
import { getWorkoutById } from '../db/workoutRepo';
import { interpretShorthand } from '../core/dsl/interpreter';
import { htmlToPdf } from '../core/pdf/playwrightPool';
import { renderWorkoutHtml } from '../core/pdf/renderHtml';

const router = Router();

router.get('/workouts/:id/pdf', async (req: Request, res: Response) => {
  const { id } = req.params;
  const viewParam = (req.query.view as string) || 'coach';
  const view = viewParam === 'swimmer' ? 'swimmer' : 'coach';

  try {
    console.log(`[PDF] Request for workout ${id}, view=${view}`);

    const workout = await getWorkoutById(id);
    if (!workout) {
      console.warn(`[PDF] Workout not found: ${id}`);
      return res.status(404).json({ error: 'Workout not found.' });
    }

    const interpreted = interpretShorthand(workout.shorthand);
    const html = renderWorkoutHtml(interpreted, view);
    const pdfBuffer = await htmlToPdf(html);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="workout-${id}-${view}.pdf"`
    );

    return res.send(pdfBuffer);
  } catch (err) {
    console.error(`[PDF] Error generating PDF for workout ${id}:`, err);
    return res.status(500).send('Failed to generate PDF.');
  }
});

export default router;