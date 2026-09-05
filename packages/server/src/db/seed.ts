import bcrypt from 'bcrypt';
import { db, pool } from './client';
import { seats, users } from './schema';
import { getAllSeatIds } from '@cinema/shared';

const DEMO_PASSWORD = 'password123';
const DEMO_USERNAMES = ['alice', 'bob', 'carol'];

async function seedSeats() {
  const ids = getAllSeatIds();
  await db
    .insert(seats)
    .values(ids.map((id) => ({ id })))
    .onConflictDoNothing();
  console.log(`Seeded ${ids.length} seats.`);
}

async function seedUsers() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const username of DEMO_USERNAMES) {
    await db
      .insert(users)
      .values({ username, passwordHash })
      .onConflictDoNothing({ target: users.username });
  }
  console.log(`Seeded demo users: ${DEMO_USERNAMES.join(', ')} (password: "${DEMO_PASSWORD}")`);
}

async function main() {
  await seedSeats();
  await seedUsers();
  await pool.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
