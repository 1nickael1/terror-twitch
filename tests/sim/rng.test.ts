import { expect, it } from 'vitest';
import { proximo } from '../../src/sim/rng';

it('é determinístico e fica em [0, 1)', () => {
  let s = 42;
  const a: number[] = [];
  for (let i = 0; i < 100; i++) { const r = proximo(s); a.push(r.valor); s = r.semente; }
  expect(a.every((v) => v >= 0 && v < 1)).toBe(true);
  expect(new Set(a).size).toBeGreaterThan(95);
  expect(proximo(42).valor).toBe(a[0]);
});
