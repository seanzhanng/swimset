import { Router, Request, Response } from 'express';
import { getWorkoutById } from '../db/workoutRepo';
import { interpretShorthand } from '../core/dsl/interpreter';
import { renderWorkoutHtml, PdfViewMode } from '../core/pdf/renderHtml';
import { htmlToPdf } from '../core/pdf/playwrightPool';

const router = Router();

/**
 * GET /workouts/:id/pdf?view=coach|swimmer
 *
 * Returns a PDF representation of the workout.
 */
router.get('/:id/pdf', async (req: Request, res: Response) => {
  const { id } = req.params;
  const viewParam = (req.query.view as string | undefined)?.toLowerCase() as PdfViewMode | undefined;
  const view: PdfViewMode = viewParam === 'swimmer' ? 'swimmer' : 'coach';

  try {
    const workout = await getWorkoutById(id);

    if (!workout) {
      console.warn(`[pdf] workout not found: ${id}`);
      return res.status(404).send('Workout not found.');
    }

    console.log(`[pdf] generating PDF for workout ${id}, view=${view}`);

    const interpreted = interpretShorthand(workout.shorthand);
    const html = renderWorkoutHtml(interpreted, view);
    const pdfBuffer = await htmlToPdf(html);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="workout-${workout.id}-${view}.pdf"`
    );

    return res.send(pdfBuffer);
  } catch (err) {
    console.error('[pdf] Error generating PDF:', err);
    return res
      .status(500)
      .set('Content-Type', 'text/plain; charset=utf-8')
      .send('Failed to generate PDF. Check server logs for details.');
  }
});

export default router;