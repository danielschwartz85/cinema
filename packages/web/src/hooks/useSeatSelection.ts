import { useCallback, useEffect, useMemo, useState } from 'react';
import { checkRule1, checkRule2, parseSeatId, type ParsedSeat } from '@cinema/shared';
import type { Seat } from '../api/types';

export interface SelectionValidation {
  valid: boolean;
  reason?: string;
}

export interface UseSeatSelectionResult {
  selection: string[];
  toggle: (seatId: string) => void;
  clear: () => void;
  validation: SelectionValidation;
}

/**
 * Local (non-Redux) selection state, with the whole selection re-validated
 * live against Rule 1 + Rule 2 (mirrors @cinema/shared's checkRule1/checkRule2
 * — the same functions the server enforces on POST /reservations) on every
 * change to the selection itself or to live seat data (e.g. a 15s poll tick).
 */
export function useSeatSelection(seats: Seat[]): UseSeatSelectionResult {
  const [selection, setSelection] = useState<string[]>([]);

  const seatStateById = useMemo(() => {
    const map = new Map<string, Seat['state']>();
    for (const seat of seats) map.set(seat.id, seat.state);
    return map;
  }, [seats]);

  // If a selected seat stopped being available (someone else took it, or a
  // poll tick reconciled an expiry), drop it from the selection so it can
  // never silently "come back" if that seat later becomes available again.
  useEffect(() => {
    setSelection((current) => {
      const next = current.filter((id) => seatStateById.get(id) === 'available');
      return next.length === current.length ? current : next;
    });
  }, [seatStateById]);

  const toggle = useCallback(
    (seatId: string) => {
      if (seatStateById.get(seatId) !== 'available') return;
      setSelection((current) =>
        current.includes(seatId) ? current.filter((id) => id !== seatId) : [...current, seatId]
      );
    },
    [seatStateById]
  );

  const clear = useCallback(() => setSelection([]), []);

  const validation = useMemo<SelectionValidation>(() => {
    if (selection.length === 0) return { valid: false, reason: 'Select at least one seat.' };

    // Parse the selected seat IDs into row + seat number components.
    const parsedSeats: ParsedSeat[] = [];
    for (const id of selection) {
      const parsed = parseSeatId(id);
      if (!parsed) return { valid: false, reason: `Invalid seat id "${id}".` };
      parsedSeats.push(parsed);
    }

    const rule1 = checkRule1(parsedSeats);
    if (!rule1.valid) return { valid: false, reason: rule1.reason };

    // Calculate the occupied seat numbers in the same row as the first selected seat.
    const row = parsedSeats[0].row;
    const selectedNumbers = parsedSeats.map((p) => p.seatNumber);
    const occupiedNumbers: number[] = [];
    for (const seat of seats) {
      if (seat.state === 'available') continue;
      const parsed = parseSeatId(seat.id);
      if (parsed && parsed.row === row) occupiedNumbers.push(parsed.seatNumber);
    }

    const rule2 = checkRule2(row, occupiedNumbers, selectedNumbers);
    if (!rule2.valid) return { valid: false, reason: rule2.reason };

    return { valid: true };
  }, [selection, seats]);

  return { selection, toggle, clear, validation };
}
