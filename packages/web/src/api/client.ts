import type { LoginResponse, Reservation, Seat } from '@cinema/shared';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** Thrown for any non-2xx response; carries the HTTP status and the server's `{error}` message. */
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; token?: string | null; body?: unknown } = {}
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const data = await res.json();
      if (typeof data?.error === 'string') message = data.error;
    } catch {
      // response body wasn't JSON — fall back to the generic message above
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function login(username: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/login', { method: 'POST', body: { username, password } });
}

export function getSeats(token: string): Promise<{ seats: Seat[] }> {
  return request<{ seats: Seat[] }>('/seats', { token });
}

export function getReservations(token: string): Promise<{ reservations: Reservation[] }> {
  return request<{ reservations: Reservation[] }>('/reservations', { token });
}

export function createReservation(
  token: string,
  seatIds: string[]
): Promise<{ reservation: Reservation }> {
  return request<{ reservation: Reservation }>('/reservations', {
    method: 'POST',
    token,
    body: { seatIds },
  });
}

export function completeReservation(
  token: string,
  reservationId: string
): Promise<{ reservation: Reservation }> {
  return request<{ reservation: Reservation }>(`/reservations/${reservationId}/complete`, {
    method: 'POST',
    token,
  });
}
