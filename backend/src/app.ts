import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import interpretRouter from './routes/interpret';
import generateRouter from './routes/generate';
import workoutsRouter from './routes/workouts';
import pdfRouter from './routes/pdf';

const app: Application = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check route
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', service: 'swimset-backend' });
});

// Domain routes
app.use('/interpret', interpretRouter);
app.use('/generate', generateRouter);
app.use('/workouts', workoutsRouter);
app.use('/workouts', pdfRouter); // provides /workouts/:id/pdf

// 404 handler for unknown routes
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Basic error handler (best-practice minimal version)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;