// tests/sim/catalogo.test.ts — nomes que as fases podem citar
import { describe, expect, it } from 'vitest';
import { MUSICAS, REVESTIMENTOS, SONS_DE_EVENTO, SONS_DE_FUNDO, TIPOS_PROP } from '../../src/sim/catalogo';

describe('catálogo', () => {
  it('lista os nomes do adendo do CP2 (primeiro, na mesma ordem)', () => {
    expect(SONS_DE_FUNDO.slice(0, 2)).toEqual(['zumbido', 'ventilacao']);
    expect(MUSICAS).toEqual(['tensao']);
    expect(SONS_DE_EVENTO.slice(0, 3)).toEqual(['bip', 'sirene_curta', 'estalo']);
    expect(TIPOS_PROP.slice(0, 8)).toEqual(['mesa', 'cadeira', 'armario', 'caixa', 'maca', 'cama', 'placa', 'lixeira']);
  });

  it('acrescenta os nomes do adendo do CP3', () => {
    expect(SONS_DE_FUNDO).toEqual(['zumbido', 'ventilacao', 'hospital']);
    expect(SONS_DE_EVENTO).toEqual(['bip', 'sirene_curta', 'estalo', 'gaveta', 'elevador']);
    expect(TIPOS_PROP.slice(8)).toEqual(['gavetas', 'cortina', 'autoclave', 'carrinho', 'lampada_uv']);
  });

  it('revestimentos de parede por fase (C3.5, correção 1)', () => {
    expect(REVESTIMENTOS).toEqual(['escritorio', 'azulejo']);
  });
});
