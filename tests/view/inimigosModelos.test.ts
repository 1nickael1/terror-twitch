import { describe, expect, it } from 'vitest';
import { MaterialBank } from '../../src/engine/materials';
import { ModelosInimigos } from '../../src/engine/view/inimigosModelos';
import { Recursos } from '../../src/engine/view/recursos';

function modelos(): ModelosInimigos {
  const bank = new MaterialBank();
  bank.define('ini-corpo', { vertexColors: true });
  bank.define('ini-olho', { emissive: 0xffffff });
  bank.define('ini-visor', { emissive: 0xff8000 });
  return new ModelosInimigos(new Recursos(bank));
}

describe('ModelosInimigos', () => {
  it('no máximo 8 malhas por inimigo', () => {
    const m = modelos();
    for (const tipo of ['funcionario', 'seguranca', 'entidade096', 'tipo_desconhecido_qualquer', 'nao_existe']) {
      expect(m.montar(tipo).malhas.length).toBeLessThanOrEqual(8);
    }
  });

  it('inimigos do mesmo tipo compartilham as geometrias unidas', () => {
    const m = modelos();
    const a = m.montar('funcionario').malhas.map((x) => x.malha.geometry);
    const b = m.montar('funcionario').malhas.map((x) => x.malha.geometry);
    expect(b).toEqual(a);
    expect(b.every((g, i) => g === a[i])).toBe(true);
  });

  it('peças comuns têm cor de vértice; sombra só no tronco e nas pernas', () => {
    const rig = modelos().montar('seguranca');
    const comuns = rig.malhas.filter((x) => !x.emissivo);
    expect(comuns.every((x) => x.malha.geometry.getAttribute('color') !== undefined)).toBe(true);
    expect(rig.malhas.filter((x) => x.sombra).length).toBe(3);
  });

  it('o crachá do funcionário não apaga na morte; os olhos apagam', () => {
    const rig = modelos().montar('funcionario');
    const emissivas = rig.malhas.filter((x) => x.emissivo);
    expect(emissivas.some((x) => !x.apaga)).toBe(true);
    expect(emissivas.some((x) => x.apaga)).toBe(true);
  });

  it('entidade096: antebraços no cotovelo, olhos frios próprios, sombra só no tronco e nas pernas', () => {
    const rig = modelos().montar('entidade096');
    expect(rig.malhas.length).toBe(8);
    expect(rig.ossos.antebracoE).toBeDefined();
    expect(rig.ossos.antebracoD).toBeDefined();
    expect(rig.ossos.antebracoE?.parent).toBe(rig.ossos.bracoE);
    const olhos = rig.malhas.filter((x) => x.emissivo);
    expect(olhos.map((x) => x.slot)).toEqual(['chefe-olho']);
    expect(olhos[0].apaga).toBe(true);
    const comSombra = rig.malhas.filter((x) => x.sombra);
    expect(comSombra.length).toBe(3);
    expect(comSombra.every((x) => !x.emissivo)).toBe(true);
  });

  it('entidade096 tem 2,4 m: o corpo escala pela altura do tipo', () => {
    const rig = modelos().montar('entidade096');
    expect(rig.corpo.scale.y).toBeCloseTo(2.4 / 1.8);
  });

  it('os outros tipos não ganham antebraço', () => {
    const rig = modelos().montar('funcionario');
    expect(rig.ossos.antebracoE).toBeUndefined();
  });
});
