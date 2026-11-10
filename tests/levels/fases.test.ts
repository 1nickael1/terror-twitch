import { describe, expect, it } from 'vitest';
import { FASES } from '../../src/levels/indice';
import { percorrer } from '../../src/levels/robo';
import { validarFase } from '../../src/levels/validar';

describe.each(FASES.map((f) => [f.id, f] as const))('fase %s', (_id, fase) => {
  it('passa no validador', () => {
    expect(validarFase(fase)).toEqual([]);
  });
  it('o robô chega à saída', () => {
    const r = percorrer(fase, 600);
    expect(r.motivo).toBe('saída');
    expect(r.concluiu).toBe(true);
  });
});

it('ids de fase são únicos', () => {
  expect(new Set(FASES.map((f) => f.id)).size).toBe(FASES.length);
});
