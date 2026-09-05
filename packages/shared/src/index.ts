// Explicit named re-exports (rather than `export *`) so bundlers consuming
// the compiled CommonJS output (e.g. Vite/Rollup building @cinema/web) can
// statically detect the named exports — `export *` compiles to a dynamic
// `for...in` re-export loop that Rollup's CJS interop can't analyze.
export { ROWS, TOTAL_SEATS, isValidRow, getRowSize, seatId, parseSeatId, getRowSeatIds, getAllSeatIds } from './layout';
export type { RowSpec, ParsedSeat } from './layout';
export { checkRule1, checkRule2 } from './seating';
export type { RuleResult } from './seating';
export {
  loginRequestSchema,
  createReservationRequestSchema,
  reservationIdParamsSchema,
} from './api';
export type {
  SeatState,
  Seat,
  ReservationStatus,
  Reservation,
  AuthUser,
  LoginResponse,
  LoginRequest,
  CreateReservationRequest,
  ReservationIdParams,
} from './api';
