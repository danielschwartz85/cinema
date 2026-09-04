/**
 * Typed application error carrying an HTTP status code, so route handlers can
 * throw domain/validation failures and let the central error handler map
 * them to the right response (see PRD status-code table).
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message: string) {
    return new AppError(400, message);
  }
  static unauthorized(message = 'Unauthorized') {
    return new AppError(401, message);
  }
  static forbidden(message = 'Forbidden') {
    return new AppError(403, message);
  }
  static notFound(message = 'Not found') {
    return new AppError(404, message);
  }
  static conflict(message: string) {
    return new AppError(409, message);
  }
  static gone(message: string) {
    return new AppError(410, message);
  }
  static unprocessable(message: string) {
    return new AppError(422, message);
  }
}
