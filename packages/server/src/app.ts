import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth';
import { seatsRouter } from './routes/seats';
import { reservationsRouter } from './routes/reservations';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { env } from './config/env';

/** Express app factory — no listen() here, so tests can import and drive it directly (e.g. via supertest). */
export function createApp() {
  const app = express();
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json());
  app.use(requestLogger);

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/auth', authRouter);
  app.use('/seats', seatsRouter);
  app.use('/reservations', reservationsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
