import { sql } from 'drizzle-orm';
import { db, pool } from './client';
import { reservations, reservationSeats, seats, users } from './schema';

/** Wipes all rows from every table (schema/migrations untouched). CASCADE handles FK order. */
async function main() {
  await db.execute(
    sql`TRUNCATE TABLE ${reservationSeats}, ${reservations}, ${seats}, ${users} CASCADE`
  );
  console.log('Database cleaned.');
  await pool.end();
}

main().catch((err) => {
  console.error('Clean failed:', err);
  process.exit(1);
});
