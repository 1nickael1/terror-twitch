// tests/sim/catalogo.test.ts — nomes que as fases podem citar
import { describe, expect, it } from 'vitest';
import { MUSICAS, SONS_DE_EVENTO, SONS_DE_FUNDO, TIPOS_PROP } from '../../src/sim/catalogo';

describe('catálogo', () => {
  it('lista os nomes do adendo do CP2', () => {
    expect(SONS_DE_FUNDO).toEqual(['zumbido', 'ventilacao']);
    expect(MUSICAS).toEqual(['tensao']);
    expect(SONS_DE_EVENTO).toEqual(['bip', 'sirene_curta', 'estalo']);
    expect(TIPOS_PROP).toEqual(['mesa', 'cadeira', 'armario', 'caixa', 'maca', 'cama', 'placa', 'lixeira']);
  });
});
