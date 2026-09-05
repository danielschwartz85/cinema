import { useCallback, useEffect, useState } from 'react';
import { ApiError, getReservations, getSeats } from '../api/client';
import type { Reservation, Seat } from '../api/types';

const POLL_INTERVAL_MS = Number(import.meta.env.VITE_POLL_INTERVAL_MS ?? 15_000);

export interface UseCinemaDataResult {
  seats: Seat[];
  reservations: Reservation[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Loads seats + the current user's reservations, then re-polls both every
 * POLL_INTERVAL_MS so the seat map and reservation state stay fresh without
 * user action.
 */
export function useCinemaData(token: string | null, onUnauthorized: () => void): UseCinemaDataResult {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!token) return;
    try {
      const [seatsRes, reservationsRes] = await Promise.all([getSeats(token), getReservations(token)]);
      setSeats(seatsRes.seats);
      setReservations(reservationsRes.reservations);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onUnauthorized();
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load cinema data.');
    } finally {
      setLoading(false);
    }
  }, [token, onUnauthorized]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    refetch();
    const interval = setInterval(refetch, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token, refetch]);

  return { seats, reservations, loading, error, refetch };
}
