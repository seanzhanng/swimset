import express from 'express';
import cors from 'cors';
import interpretRouter from './routes/interpret';
import generateRouter from './routes/generate';
import workoutsRouter from './routes/workouts';
import pdfRouter from './routes/pdf';
import statsRouter from './routes/stats';
import { initPlaywright } from './core/pdf/playwrightPool';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/interpret', interpretRouter);
app.use('/generate', generateRouter);
app.use('/workouts', workoutsRouter);
app.use('/stats', statsRouter);

app.use(pdfRouter);

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await initPlaywright();
    app.listen(PORT, () => {
      console.log(`SwimSet backend listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
