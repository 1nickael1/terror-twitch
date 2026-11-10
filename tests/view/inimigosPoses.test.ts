import { describe, expect, it } from 'vitest';
import type { PoseBase } from '../../src/engine/view/inimigosModelos';
import {
  GOLPE, RAMPA_PREPARO, SENTADO_EM, calcularPose, desenhadoComoCorpo, novaPose, progressoLevantar, type EstadoVisual,
} from '../../src/engine/view/inimigosPoses';
import { CIRURGICO, ENFERMEIRO, estiloAtaque, FUNCIONARIO, REANIMADO, SEGURANCA } from '../../src/engine/view/moldesInimigos';
import type { Inimigo } from '../../src/sim/world';

const BASE: PoseBase = {
  quadril: 0.86, troncoX: -0.16, cabecaX: -0.25, cabecaZ: 0.5, bracoX: 0.14, bracoZ: 0.06,
  bracoDFixo: null, balancoBraco: 1, mole: 1,
};
const parado: EstadoVisual = { t: 0, vel: 0, passada: 0, golpe: -1, dor: 1 };

describe('calcularPose', () => {
  it('morto: deitado de costas no chão', () => {
    const p = novaPose();
    calcularPose(p, BASE, parado, { modo: 'morto', timer: 0, tipo: 'funcionario' });
    expect(p.corpoX).toBeCloseTo(Math.PI / 2);
  });

  it('dormindo: sentado (quadril baixo, pernas para a frente)', () => {
    const p = novaPose();
    calcularPose(p, BASE, parado, { modo: 'dormindo', timer: 0, tipo: 'funcionario' });
    expect(p.pelveY).toBeLessThan(0.4);
    expect(p.pernaEX).toBeGreaterThan(1);
  });

  it('ataque: os braços sobem conforme o preparo avança', () => {
    const inicio = novaPose();
    const fim = novaPose();
    expect(calcularPose(inicio, BASE, parado, { modo: 'ataque', timer: 0.35, tipo: 'funcionario' })).toBe(0);
    expect(calcularPose(fim, BASE, parado, { modo: 'ataque', timer: 0, tipo: 'funcionario' })).toBe(1);
    expect(fim.bracoDX).toBeGreaterThan(inicio.bracoDX + 2);
  });

  it('ataque: a pose fica pronta cedo (a 60% do preparo) com o braço bem acima do ombro', () => {
    const p = novaPose();
    // preparo do funcionário = 0,35 s; 60% dele já passou
    const k = calcularPose(p, BASE, parado, { modo: 'ataque', timer: 0.35 * (1 - RAMPA_PREPARO), tipo: 'funcionario' });
    expect(k).toBeCloseTo(1);
    expect(p.bracoDX).toBeGreaterThan(Math.PI * 0.85);
    const meio = novaPose();
    expect(calcularPose(meio, BASE, parado, { modo: 'ataque', timer: 0.35 * 0.7, tipo: 'funcionario' })).toBeCloseTo(0.5);
  });

  it('fora do ataque o progresso do preparo é 0', () => {
    expect(calcularPose(novaPose(), BASE, parado, { modo: 'perseguicao', timer: 0, tipo: 'seguranca' })).toBe(0);
  });

  it('andar: as pernas balançam com a velocidade', () => {
    const p = novaPose();
    calcularPose(p, BASE, { ...parado, vel: 3, passada: Math.PI / 2 }, { modo: 'perseguicao', timer: 0, tipo: 'funcionario' });
    expect(p.pernaEX).toBeGreaterThan(0.3);
    expect(p.pernaDX).toBeLessThan(-0.3);
  });

  it('tipo desconhecido não lança erro', () => {
    const p = novaPose();
    expect(() => calcularPose(p, BASE, parado, { modo: 'ataque', timer: 0.2, tipo: 'nao_existe' })).not.toThrow();
  });
});

describe('calcularPose: fase 2', () => {
  const pose = (b: PoseBase, v: EstadoVisual, modo: Inimigo['modo'], tipo: string, timer = 0) => {
    const p = novaPose();
    const k = calcularPose(p, b, v, { modo, timer, tipo });
    return { p, k };
  };

  it('cirúrgico deitado dormindo é desenhado como corpo (de costas, sem respirar); o comum dorme sentado', () => {
    expect(desenhadoComoCorpo({ modo: 'dormindo', tipo: 'reanimado_cirurgico' })).toBe(true);
    expect(desenhadoComoCorpo({ modo: 'dormindo', tipo: 'funcionario' })).toBe(false);
    expect(desenhadoComoCorpo({ modo: 'morto', tipo: 'reanimado' })).toBe(true);
    expect(desenhadoComoCorpo({ modo: 'levantando', tipo: 'reanimado_cirurgico' })).toBe(false);
    const a = pose(CIRURGICO.base, { ...parado, t: 1 }, 'dormindo', 'reanimado_cirurgico').p;
    const b = pose(CIRURGICO.base, { ...parado, t: 2.3 }, 'dormindo', 'reanimado_cirurgico').p;
    expect(a.corpoX).toBeCloseTo(Math.PI / 2);
    expect(a).toEqual(b);
  });

  it('levantando: do chão (como o corpo) a sentado e a de pé, pelo progresso', () => {
    const morto = pose(REANIMADO.base, parado, 'morto', 'reanimado').p;
    const inicio = pose(REANIMADO.base, { ...parado, levantar: 0 }, 'levantando', 'reanimado').p;
    expect(inicio.corpoX).toBeCloseTo(morto.corpoX);
    expect(inicio.pelveY).toBeCloseTo(morto.pelveY);
    const sentado = pose(REANIMADO.base, { ...parado, levantar: SENTADO_EM }, 'levantando', 'reanimado').p;
    expect(sentado.corpoX).toBeCloseTo(0);
    expect(sentado.pelveY).toBeLessThan(0.4);
    expect(sentado.pernaEX).toBeGreaterThan(1);
    const fim = pose(REANIMADO.base, { ...parado, levantar: 1 }, 'levantando', 'reanimado').p;
    expect(fim.corpoX).toBeCloseTo(0);
    expect(fim.pelveY).toBeCloseTo(REANIMADO.base.quadril);
    expect(Math.abs(fim.pernaEX)).toBeLessThan(0.1);
    // não ataca nem acende o preparo
    expect(pose(REANIMADO.base, { ...parado, levantar: 0.5 }, 'levantando', 'reanimado').k).toBe(0);
  });

  it('progressoLevantar: 0 ao começar, 1 no fim, pelo timer visto ao começar', () => {
    expect(progressoLevantar(0.8, 0.8)).toBe(0);
    expect(progressoLevantar(0.6, 1.2)).toBeCloseTo(0.5);
    expect(progressoLevantar(0, 1.2)).toBe(1);
    expect(progressoLevantar(-0.1, 1.2)).toBe(1);
    expect(progressoLevantar(2, 1.2)).toBe(0);
    expect(progressoLevantar(0.3, 0)).toBe(1);
  });

  it('levantando: o corpo sobe sem voltar (corpoX cai sempre até sentar)', () => {
    let anterior = Infinity;
    for (let k = 0; k <= SENTADO_EM + 1e-9; k += 0.05) {
      const p = pose(REANIMADO.base, { ...parado, levantar: k }, 'levantando', 'reanimado').p;
      expect(p.corpoX).toBeLessThanOrEqual(anterior + 1e-9);
      anterior = p.corpoX;
    }
  });

  it('reanimado: curvado, braços pendentes, cabeça caída; arrasta uma perna', () => {
    const p = pose(REANIMADO.base, parado, 'patrulha', 'reanimado').p;
    expect(p.troncoX).toBeLessThan(-0.35);
    expect(p.cabecaX).toBeLessThan(-0.2);
    // braço quase na vertical: compensa a curvatura do tronco
    expect(p.bracoEX + p.troncoX).toBeGreaterThan(-0.1);
    const andando = pose(REANIMADO.base, { ...parado, vel: 3, passada: Math.PI / 2 }, 'perseguicao', 'reanimado').p;
    expect(Math.abs(andando.pernaDX)).toBeLessThan(Math.abs(andando.pernaEX));
  });

  it('enfermeiro: no preparo leva o braço do frasco para trás da cabeça; o golpe o lança à frente', () => {
    expect(estiloAtaque(ENFERMEIRO.base)).toBe('arremesso');
    const pronto = pose(ENFERMEIRO.base, parado, 'ataque', 'enfermeiro', 0);
    expect(pronto.k).toBe(1);
    expect(pronto.p.bracoDX).toBeLessThan(-2);
    expect(pronto.p.bracoEX).toBeGreaterThan(1);
    const lancou = pose(ENFERMEIRO.base, { ...parado, golpe: GOLPE * 0.9 }, 'perseguicao', 'enfermeiro').p;
    expect(lancou.bracoDX).toBeGreaterThan(1);
  });

  it('estilos padrão: segurança aponta a arma, funcionário ergue as garras', () => {
    expect(estiloAtaque(SEGURANCA.base)).toBe('arma');
    expect(estiloAtaque(FUNCIONARIO.base)).toBe('garras');
    expect(estiloAtaque(REANIMADO.base)).toBe('garras');
  });
});
