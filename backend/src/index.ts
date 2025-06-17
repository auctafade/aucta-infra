import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'aucta-backend' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`AUCTA backend running on port ${PORT}`);
});