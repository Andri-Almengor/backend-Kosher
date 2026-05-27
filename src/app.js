const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { logger } = require('./utils/logger');

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (_req, res) => {
  res.json({ ok: true, message: 'Backend running', api: '/api' });
});

app.use('/api', routes);

app.use((req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

app.use((err, req, res, _next) => {
  logger.error(err?.stack || err);
  res.status(err?.status || 500).json({
    message: err?.message || 'Internal Server Error',
  });
});

module.exports = app;
