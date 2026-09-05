import { Router } from 'express';
import { loginRequestSchema } from '@cinema/shared';
import { login } from '../services/authService';
import { asyncHandler } from '../middleware/asyncHandler';
import { AppError } from '../types/AppError';

export const authRouter = Router();

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = loginRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.badRequest('username and password are required.');
    }
    const result = await login(parsed.data.username, parsed.data.password);
    res.json(result);
  })
);
