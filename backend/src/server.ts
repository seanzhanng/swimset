import app from './app';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.listen(PORT, () => {
  console.log(`SwimSet backend listening on http://localhost:${PORT}`);
});
