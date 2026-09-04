import { Router } from 'express';
import { authGuard } from '../middleware/authGuard';
import { asyncHandler } from '../middleware/asyncHandler';
import { listSeats } from '../services/seatService';

export const seatsRouter = Router();

seatsRouter.get(
  '/',
  authGuard,
  asyncHandler(async (_req, res) => {
    const seats = await listSeats();
    res.json({ seats });
  })
);
