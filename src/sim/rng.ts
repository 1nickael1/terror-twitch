// Gerador pseudoaleatório determinístico (mulberry32). A semente viaja no estado do mundo.

/** Devolve um valor em [0, 1) e a próxima semente. */
export function proximo(semente: number): { valor: number; semente: number } {
  const s = (semente + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), s | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { valor: ((t ^ (t >>> 14)) >>> 0) / 4294967296, semente: s };
}
