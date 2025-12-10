import app from './app';
import { initPlaywright, closePlaywright } from './core/pdf/playwrightPool';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

async function startServer(): Promise<void> {
  try {
    await initPlaywright();

    app.listen(PORT, () => {
      console.log(`SwimSet backend listening on http://localhost:${PORT}`);
    });

    process.on('SIGINT', async () => {
      console.log('\nReceived SIGINT, shutting down...');
      await closePlaywright();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\nReceived SIGTERM, shutting down...');
      await closePlaywright();
      process.exit(0);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();