import { ROWS, getRowSeatIds } from '@cinema/shared';
import type { SeatDisplay } from '../domain/seatDisplay';
import { Seat } from './Seat';
import styles from './SeatGrid.module.css';

interface SeatGridProps {
  seatDisplayMap: Map<string, SeatDisplay>;
  onToggle: (seatId: string) => void;
}

export function SeatGrid({ seatDisplayMap, onToggle }: SeatGridProps) {
  return (
    <div className={styles.grid}>
      {ROWS.map((row) => (
        <div key={row.label} className={styles.row}>
          <span className={styles.rowLabel}>{row.label}</span>
          <div className={styles.seats}>
            {getRowSeatIds(row.label).map((seatId, index) => {
              const seat = seatDisplayMap.get(seatId);
              if (!seat) return null;
              return <Seat key={seatId} seat={seat} seatNumber={index + 1} onToggle={onToggle} />;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
