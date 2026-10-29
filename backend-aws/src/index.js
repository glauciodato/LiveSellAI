require('dotenv').config(); // no-op silencioso se não existir .env (ex: produção no ECS)
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const mediaRoutes = require('./routes/media');

const app = express();

app.use(cors({ origin: process.env.CORS_ALLOWED_ORIGIN || '*' }));
app.use(express.json());

// Usado pelo health check do Application Load Balancer (ECS só considera
// a task "saudável" se isso responder 200).
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api', authRoutes);
app.use('/api', mediaRoutes);

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  console.log(`[backend-aws] Ouvindo na porta ${port}`);
});
