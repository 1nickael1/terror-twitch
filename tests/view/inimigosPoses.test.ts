import { describe, expect, it } from 'vitest';
import type { PoseBase } from '../../src/engine/view/inimigosModelos';
import { RAMPA_PREPARO, calcularPose, novaPose, type EstadoVisual } from '../../src/engine/view/inimigosPoses';

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
