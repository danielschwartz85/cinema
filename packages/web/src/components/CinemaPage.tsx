import { useCallback, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useCinemaData } from '../hooks/useCinemaData';
import { useSeatSelection } from '../hooks/useSeatSelection';
import { buildSeatDisplayMap } from '../domain/seatDisplay';
import { Legend } from './Legend';
import { SeatGrid } from './SeatGrid';
import { SelectionBar } from './SelectionBar';
import { CompletePanel } from './CompletePanel';
import styles from './CinemaPage.module.css';

export function CinemaPage() {
  const { token, user, logout } = useAuth();

  const { seats, reservations, loading, error, refetch } = useCinemaData(token, logout);
  const { selection, toggle, clear, validation: selectionValidation } = useSeatSelection(seats);

  const seatDisplayMap = useMemo(
    () => buildSeatDisplayMap(seats, reservations, selection),
    [seats, reservations, selection]
  );

  const handleMutated = useCallback(() => {
    refetch();
  }, [refetch]);

  if (!token || !user) return null; // App only mounts this once authenticated

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Cinema Reservations</h1>
        <span className={styles.user}>
          Signed in as {user.username}
          <button type="button" className={styles.logout} onClick={logout}>
            Log out
          </button>
        </span>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      {loading && seats.length === 0 ? (
        <p className={styles.loading}>Loading seats…</p>
      ) : (
        <>
          <div className={styles.screen}>Screen</div>
          <Legend />
          <SeatGrid seatDisplayMap={seatDisplayMap} onToggle={toggle} />
          <SelectionBar
            token={token}
            selection={selection}
            validation={selectionValidation}
            onReserved={handleMutated}
            clearSelection={clear}
          />
          <CompletePanel token={token} reservations={reservations} onCompleted={handleMutated} />
        </>
      )}
    </div>
  );
}
