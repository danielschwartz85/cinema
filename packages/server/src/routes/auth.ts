import { Router } from 'express';
import { z } from 'zod';
import { login } from '../services/authService';
import { asyncHandler } from '../middleware/asyncHandler';
import { AppError } from '../types/AppError';

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.badRequest('username and password are required.');
    }
    const result = await login(parsed.data.username, parsed.data.password);
    res.json(result);
  })
);
