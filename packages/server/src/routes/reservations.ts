import { Router } from 'express';
import { z } from 'zod';
import { authGuard } from '../middleware/authGuard';
import { asyncHandler } from '../middleware/asyncHandler';
import { AppError } from '../types/AppError';
import {
  completeReservation,
  createReservation,
  listUserReservations,
} from '../services/reservationService';

export const reservationsRouter = Router();

reservationsRouter.use(authGuard);

// Shape-only validation. Deeper seat semantics (valid row/number per the
// layout, Rule 1) stay in reservationService — that's business logic, not
// request-shape validation.
const createReservationSchema = z.object({
  seatIds: z.array(z.string().min(1)).min(1, 'seatIds must be a non-empty array of seat ids.'),
});

const reservationIdParamsSchema = z.object({
  id: z.string().uuid('Reservation id must be a valid UUID.'),
});

reservationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const reservations = await listUserReservations(req.user!.id);
    res.json({ reservations });
  })
);

reservationsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = createReservationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.badRequest(parsed.error.issues[0]?.message ?? 'Invalid request body.');
    }
    const reservation = await createReservation(req.user!.id, parsed.data.seatIds);
    res.status(201).json({ reservation });
  })
);

reservationsRouter.post(
  '/:id/complete',
  asyncHandler(async (req, res) => {
    const parsed = reservationIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      throw AppError.badRequest(parsed.error.issues[0]?.message ?? 'Invalid reservation id.');
    }
    const reservation = await completeReservation(req.user!.id, parsed.data.id);
    res.json({ reservation });
  })
);
