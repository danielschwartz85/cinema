import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSeatId } from '../src/layout';
import { checkRule1, checkRule2 } from '../src/seating';

function seats(row: string, numbers: number[]) {
  return numbers.map((n) => parseSeatId(`${row}-${n}`)!);
}

test('Rule 1: consecutive seats in the same row are valid', () => {
  assert.equal(checkRule1(seats('A', [5, 6, 7])).valid, true);
  assert.equal(checkRule1(seats('B', [1, 2])).valid, true);
});

test('Rule 1: non-consecutive seats are invalid', () => {
  assert.equal(checkRule1(seats('A', [5, 7])).valid, false);
});

test('Rule 1: seats spanning different rows are invalid', () => {
  assert.equal(checkRule1(seats('C', [2, 3])).valid, true); // sanity: same-row baseline
  const mixed = [parseSeatId('A-1')!, parseSeatId('B-1')!];
  assert.equal(checkRule1(mixed).valid, false);
});

test('Rule 2: "# # * * . . . . . ." is valid (PRD example)', () => {
  // # # = occupied seats 1,2. * * = newly selected seats 3,4. Rest empty.
  const result = checkRule2('A', [1, 2], [3, 4]);
  assert.equal(result.valid, true);
});

test('Rule 2: "# # . * * . . . . ." is invalid (PRD example)', () => {
  // # # = occupied 1,2. * * = newly selected 4,5. Seat 3 is trapped between 2 and 4.
  const result = checkRule2('A', [1, 2], [4, 5]);
  assert.equal(result.valid, false);
});

test('Rule 2: a single empty seat at the row edge is allowed', () => {
  // Selecting seats 2..10 in a 10-seat row leaves seat 1 empty at the edge.
  const numbers = Array.from({ length: 9 }, (_, i) => i + 2); // 2..10
  const result = checkRule2('A', [], numbers);
  assert.equal(result.valid, true);
});
