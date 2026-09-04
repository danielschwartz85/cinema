import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Wraps an async route handler so a thrown/rejected error reaches errorHandler via next(). */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
