import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  DATABASE_URL: required('DATABASE_URL'),
  JWT_SECRET: required('JWT_SECRET'),
  PORT: Number(process.env.PORT ?? 3000),
  /** How long a seat hold stays ACTIVE before it's eligible for expiry. */
  RESERVATION_TTL_MINUTES: Number(process.env.RESERVATION_TTL_MINUTES ?? 15),
  /** How often the background sweeper marks expired holds EXPIRED. */
  SWEEP_INTERVAL_MS: Number(process.env.SWEEP_INTERVAL_MS ?? 60_000),
  /** Comma-separated list of origins allowed to call the API from a browser. */
  CORS_ORIGIN: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};
