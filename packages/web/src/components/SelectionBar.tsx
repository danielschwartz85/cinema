import { useCallback, useState } from 'react';
import { ApiError, createReservation } from '../api/client';
import type { SelectionValidation } from '../hooks/useSeatSelection';
import styles from './SelectionBar.module.css';

interface SelectionBarProps {
  token: string;
  selection: string[];
  validation: SelectionValidation;
  onReserved: () => void;
  clearSelection: () => void;
}

export function SelectionBar({ token, selection, validation, onReserved, clearSelection }: SelectionBarProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReserve = useCallback(async () => {
    if (!validation.valid) return;
    setSubmitting(true);
    setError(null);
    try {
      await createReservation(token, selection);
      clearSelection();
      onReserved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reserve seats.');
    } finally {
      setSubmitting(false);
    }
  }, [token, selection, validation.valid, clearSelection, onReserved]);

  return (
    <div className={styles.bar}>
      <div className={styles.row}>
        <span className={styles.seats}>
          {selection.length > 0 ? `Selected: ${selection.join(', ')}` : 'No seats selected'}
        </span>
        <button
          type="button"
          className={styles.button}
          disabled={!validation.valid || submitting}
          onClick={handleReserve}
        >
          {submitting ? 'Reserving…' : 'Reserve seats'}
        </button>
      </div>
      {!validation.valid && validation.reason && selection.length > 0 && (
        <span className={styles.reason}>{validation.reason}</span>
      )}
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}
