import { Router } from 'express';
import { createReservationRequestSchema, reservationIdParamsSchema } from '@cinema/shared';
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
    const parsed = createReservationRequestSchema.safeParse(req.body);
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
