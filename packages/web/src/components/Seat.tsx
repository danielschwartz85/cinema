import { memo } from 'react';
import type { SeatDisplay } from '../domain/seatDisplay';
import styles from './Seat.module.css';

interface SeatProps {
  seat: SeatDisplay;
  seatNumber: number;
  onToggle: (seatId: string) => void;
}

function SeatImpl({ seat, seatNumber, onToggle }: SeatProps) {
  return (
    <button
      type="button"
      className={`${styles.seat} ${styles[seat.status]}`}
      disabled={!seat.clickable}
      onClick={() => onToggle(seat.id)}
      title={`${seat.id} — ${seat.status.replace('-', ' ')}`}
      aria-pressed={seat.status === 'selected'}
    >
      {seatNumber}
    </button>
  );
}

export const Seat = memo(SeatImpl);
