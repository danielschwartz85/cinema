import styles from './Legend.module.css';

const ITEMS: Array<{ label: string; color: string }> = [
  { label: 'Available', color: 'var(--seat-available)' },
  { label: 'Selected', color: 'var(--seat-selected)' },
  { label: 'Isolated (unselectable)', color: 'var(--seat-isolated)' },
  { label: 'Your reservation', color: 'var(--seat-mine-reserved)' },
  { label: 'Your booking', color: 'var(--seat-mine-booked)' },
  { label: 'Reserved by others', color: 'var(--seat-reserved)' },
  { label: 'Booked by others', color: 'var(--seat-booked)' },
];

export function Legend() {
  return (
    <div className={styles.legend}>
      {ITEMS.map((item) => (
        <span key={item.label} className={styles.item}>
          <span className={styles.swatch} style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
