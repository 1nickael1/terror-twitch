import { describe, expect, it } from 'vitest';
import { MaterialBank } from '../../src/engine/materials';
import { ModelosInimigos, MOLDES } from '../../src/engine/view/inimigosModelos';
import { Recursos } from '../../src/engine/view/recursos';
import { TIPOS } from '../../src/sim/ai/tipos';

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

  it('todo tipo do catálogo tem molde próprio (nenhum cai no genérico)', () => {
    for (const tipo of Object.keys(TIPOS).filter((t) => !t.endsWith('_teste'))) expect(MOLDES[tipo]).toBeDefined();
  });

  it('fase 2: reanimado, cirúrgico, enfermeiro e 049 no orçamento de 8 malhas, sombra só no tronco e nas pernas', () => {
    const m = modelos();
    for (const tipo of ['reanimado', 'reanimado_cirurgico', 'enfermeiro', 'entidade049']) {
      const rig = m.montar(tipo);
      expect(rig.malhas.length).toBeLessThanOrEqual(8);
      expect(rig.malhas.filter((x) => x.sombra).length).toBe(3);
      // olhos (ou lentes) apagam na morte
      expect(rig.malhas.some((x) => x.emissivo && x.apaga)).toBe(true);
    }
  });

  it('enfermeiro: o frasco da mão direita brilha no preparo (malha de brilho no braço direito)', () => {
    const rig = modelos().montar('enfermeiro');
    const brilho = rig.malhas.filter((x) => x.brilho);
    expect(brilho.length).toBe(1);
    expect(brilho[0].malha.parent).toBe(rig.ossos.bracoD);
  });

  it('entidade049: 2,0 m, lentes da máscara num slot próprio e a palma do toque com brilho', () => {
    const rig = modelos().montar('entidade049');
    expect(rig.corpo.scale.y).toBeCloseTo(2.0 / 1.8);
    const emissivas = rig.malhas.filter((x) => x.emissivo && !x.brilho);
    expect(emissivas.map((x) => x.slot)).toEqual(['chefe049-lente']);
    const palma = rig.malhas.filter((x) => x.brilho);
    expect(palma.length).toBe(1);
    expect(palma[0].malha.parent).toBe(rig.ossos.bracoD);
    // cor própria do brilho (fria), diferente da boca da arma do segurança
    const seg = modelos().montar('seguranca').malhas.find((x) => x.brilho);
    const cor = (x: typeof palma[0]) => (x.malha.material as unknown as { color: { getHex(): number } }).color.getHex();
    expect(seg).toBeDefined();
    expect(cor(palma[0])).not.toBe(cor(seg!));
  });

  it('moldes da fase 2 escalam pelo tipo (cirúrgico 1,75 m, reanimado mais largo)', () => {
    const m = modelos();
    expect(m.montar('reanimado_cirurgico').corpo.scale.y).toBeCloseTo(1.75 / 1.8);
    expect(m.montar('reanimado').corpo.scale.x).toBeCloseTo(0.38 / 0.35);
  });
});
