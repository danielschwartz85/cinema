import { z } from 'zod';

export type SeatState = 'available' | 'reserved' | 'booked';

export interface Seat {
  id: string;
  state: SeatState;
}

export type ReservationStatus = 'ACTIVE' | 'COMPLETED' | 'EXPIRED';

export interface Reservation {
  id: string;
  status: ReservationStatus;
  seatIds: string[];
  createdAt: string;
  expiresAt: string;
  completedAt: string | null;
}

export interface AuthUser {
  id: string;
  username: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export const loginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

// Shape-only validation. Deeper seat semantics (valid row/number per the
// layout, Rule 1) stay in the server's reservationService — that's business
// logic, not request-shape validation.
export const createReservationRequestSchema = z.object({
  seatIds: z.array(z.string().min(1)).min(1, 'seatIds must be a non-empty array of seat ids.'),
});
export type CreateReservationRequest = z.infer<typeof createReservationRequestSchema>;

export const reservationIdParamsSchema = z.object({
  id: z.string().uuid('Reservation id must be a valid UUID.'),
});
export type ReservationIdParams = z.infer<typeof reservationIdParamsSchema>;
