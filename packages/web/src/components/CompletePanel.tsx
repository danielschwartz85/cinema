import { useCallback, useMemo, useState } from 'react';
import { ApiError, completeReservation } from '../api/client';
import type { Reservation } from '../api/types';
import styles from './CompletePanel.module.css';

interface CompletePanelProps {
  token: string;
  reservations: Reservation[];
  onCompleted: () => void;
}

function formatExpiry(expiresAt: string): string {
  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  if (remainingMs <= 0) return 'expiring…';
  const minutes = Math.max(1, Math.round(remainingMs / 60_000));
  return `expires in ~${minutes} min`;
}

export function CompletePanel({ token, reservations, onCompleted }: CompletePanelProps) {
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Only ACTIVE reservations can be completed — an EXPIRED one is reported as
  // such by GET /reservations without waiting for the sweep.
  const activeReservations = useMemo(
    () => reservations.filter((r) => r.status === 'ACTIVE'),
    [reservations]
  );

  const handleComplete = useCallback(
    async (reservationId: string) => {
      setCompletingId(reservationId);
      setError(null);
      try {
        await completeReservation(token, reservationId);
        onCompleted();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to complete reservation.');
      } finally {
        setCompletingId(null);
      }
    },
    [token, onCompleted]
  );

  return (
    <div className={styles.panel}>
      <p className={styles.title}>Your active reservations</p>
      {activeReservations.length === 0 ? (
        <span className={styles.empty}>You have no active holds to complete.</span>
      ) : (
        <div className={styles.list}>
          {activeReservations.map((reservation) => (
            <div key={reservation.id} className={styles.row}>
              <span className={styles.seats}>
                {reservation.seatIds.join(', ')}
                <span className={styles.expiry}>{formatExpiry(reservation.expiresAt)}</span>
              </span>
              <button
                type="button"
                className={styles.button}
                disabled={completingId === reservation.id}
                onClick={() => handleComplete(reservation.id)}
              >
                {completingId === reservation.id ? 'Completing…' : 'Complete'}
              </button>
            </div>
          ))}
        </div>
      )}
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}
