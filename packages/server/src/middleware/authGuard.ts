import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../types/AppError';
import type { AuthUser } from '../types/express';

export function authGuard(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(AppError.unauthorized('Missing or malformed Authorization header.'));
  }

  const token = header.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthUser & jwt.JwtPayload;
    req.user = { id: payload.id, username: payload.username };
    next();
  } catch {
    next(AppError.unauthorized('Invalid or expired token.'));
  }
}
