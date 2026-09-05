import { randomUUID } from 'node:crypto';
import {
  boolean,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Static seat catalog. Deliberately just an id (e.g. "A-5") — row label,
 * seat number, and row size are all derived from `@cinema/shared`'s
 * `layout.ts`, not stored here.
 */
export const seats = pgTable('seats', {
  id: text('id').primaryKey(),
});

export const reservationStatus = pgEnum('reservation_status', ['ACTIVE', 'COMPLETED', 'EXPIRED']);

export const reservations = pgTable('reservations', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  status: reservationStatus('status').notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

/**
 * Join table between reservations and seats. `active` is the crux of the
 * concurrency guarantee: it means "this seat is currently occupied by this
 * hold" (true for a live ACTIVE hold or a COMPLETED booking; flipped to
 * false on expiry). The partial unique index below makes it physically
 * impossible for two rows to claim the same seat while both active.
 */
export const reservationSeats = pgTable(
  'reservation_seats',
  {
    reservationId: uuid('reservation_id')
      .notNull()
      .references(() => reservations.id, { onDelete: 'cascade' }),
    seatId: text('seat_id')
      .notNull()
      .references(() => seats.id),
    active: boolean('active').notNull().default(true),
  },
  (table) => [
    primaryKey({ columns: [table.reservationId, table.seatId] }),
    uniqueIndex('uniq_active_seat')
      .on(table.seatId)
      .where(sql`${table.active} = true`),
  ]
);
