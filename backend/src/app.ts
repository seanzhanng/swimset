import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import interpretRouter from './routes/interpret';
import generateRouter from './routes/generate';
import workoutsRouter from './routes/workouts';
import pdfRouter from './routes/pdf';

const app: Application = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', service: 'swimset-backend' });
});

app.use('/interpret', interpretRouter);
app.use('/generate', generateRouter);
app.use('/workouts', workoutsRouter);
app.use('/workouts', pdfRouter);

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;