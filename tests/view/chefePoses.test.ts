import { describe, expect, it } from 'vitest';
import { calcularPoseChefe, GOLPE_CHEFE, type EntradaChefe } from '../../src/engine/view/chefePoses';
import { DOR_VISUAL, novaPose, type EstadoVisual, type Pose } from '../../src/engine/view/inimigosPoses';
import { ENTIDADE096 } from '../../src/engine/view/moldeChefe';

const B = ENTIDADE096.base;
const vis = (p: Partial<EstadoVisual> = {}): EstadoVisual => ({ t: 1, vel: 0, passada: 0, golpe: -1, dor: DOR_VISUAL, ...p });
const ent = (p: Partial<EntradaChefe> = {}): EntradaChefe => ({ fase: 'inerte', timer: 0, perto: false, ...p });

function pose(v: EstadoVisual, e: EntradaChefe): Pose {
  const p = novaPose();
  calcularPoseChefe(p, B, v, e);
  return p;
}

/** mãos no rosto: braço erguido à frente e antebraço dobrado de volta */
function maosNoRosto(p: Pose): boolean {
  return p.bracoEX > 1 && p.bracoDX > 1 && p.antebracoEX > 2 && p.antebracoDX > 2;
}

describe('calcularPoseChefe', () => {
  it('inerte: de pé, curvado, braços soltos; balanço lento e tremor leve nos ombros', () => {
    const a = pose(vis({ t: 1 }), ent());
    const b = pose(vis({ t: 1.03 }), ent());
    expect(a.troncoX).toBeLessThan(-0.2);
    expect(a.pelveY).toBeCloseTo(B.quadril, 1);
    expect(Math.abs(a.bracoEX)).toBeLessThan(0.4);
    expect(maosNoRosto(a)).toBe(false);
    // tremor: muda em 30 ms, mas pouco
    expect(a.bracoEZ).not.toBeCloseTo(b.bracoEZ, 4);
    expect(Math.abs(a.bracoEZ - b.bracoEZ)).toBeLessThan(0.05);
  });

  it('despertando: mãos cobrindo o rosto, tremor forte', () => {
    const a = pose(vis({ t: 1 }), ent({ fase: 'despertando', timer: 2 }));
    const b = pose(vis({ t: 1.02 }), ent({ fase: 'despertando', timer: 2 }));
    expect(maosNoRosto(a)).toBe(true);
    const tremorDesp = Math.abs(a.troncoX - b.troncoX) + Math.abs(a.troncoZ - b.troncoZ);
    const i1 = pose(vis({ t: 1 }), ent());
    const i2 = pose(vis({ t: 1.02 }), ent());
    const tremorInerte = Math.abs(i1.troncoX - i2.troncoX) + Math.abs(i1.troncoZ - i2.troncoZ);
    expect(tremorDesp).toBeGreaterThan(tremorInerte * 3);
  });

  it('perseguição: braços soltos para trás e passada larga', () => {
    const p = pose(vis({ vel: 8, passada: Math.PI / 2 }), ent({ fase: 'perseguicao' }));
    expect(p.bracoEX).toBeLessThan(-0.2);
    expect(p.bracoDX).toBeLessThan(-0.2);
    expect(Math.abs(p.pernaEX - p.pernaDX)).toBeGreaterThan(1.4);
    expect(p.troncoX).toBeLessThan(-0.3);
  });

  it('perseguição perto do jogador: um braço erguido para o golpe; o golpe desce o braço', () => {
    const preparo = pose(vis({ vel: 0 }), ent({ fase: 'perseguicao', perto: true }));
    expect(preparo.bracoDX).toBeGreaterThan(2.3);
    const fim = pose(vis({ vel: 0, golpe: GOLPE_CHEFE * 0.9 }), ent({ fase: 'perseguicao', perto: true }));
    expect(fim.bracoDX).toBeLessThan(preparo.bracoDX - 1.5);
  });

  it('arrombando: golpes alternados dos dois braços à frente', () => {
    const a = pose(vis({ t: 0.2 }), ent({ fase: 'arrombando', timer: 2 }));
    const b = pose(vis({ t: 0.7 }), ent({ fase: 'arrombando', timer: 2 }));
    for (const p of [a, b]) {
      expect(p.bracoEX).toBeGreaterThan(0.6);
      expect(p.bracoDX).toBeGreaterThan(0.6);
    }
    expect(Math.sign(a.bracoEX - a.bracoDX)).not.toBe(Math.sign(b.bracoEX - b.bracoDX));
  });

  it('investida: corpo muito inclinado para a frente, braços abertos', () => {
    const p = pose(vis({ vel: 15, passada: 1 }), ent({ fase: 'investida', timer: 1 }));
    expect(p.troncoX + p.corpoX).toBeLessThan(-0.8);
    expect(p.bracoEZ).toBeLessThan(-1);
    expect(p.bracoDZ).toBeGreaterThan(1);
  });

  it('pausa: encolhido (quadril baixo), mãos no rosto, soluçando', () => {
    const a = pose(vis({ t: 1 }), ent({ fase: 'pausa', timer: 1 }));
    const b = pose(vis({ t: 1.2 }), ent({ fase: 'pausa', timer: 1 }));
    expect(a.pelveY).toBeLessThan(B.quadril * 0.8);
    expect(maosNoRosto(a)).toBe(true);
    expect(a.troncoX).not.toBeCloseTo(b.troncoX, 3);
  });

  it('morto: de bruços no chão', () => {
    const p = pose(vis(), ent({ fase: 'morto' }));
    expect(p.corpoX).toBeCloseTo(-Math.PI / 2, 1);
  });

  it('acerto: tremor curto (sem solavanco grande), que some depois de DOR_VISUAL', () => {
    const base = pose(vis({ t: 1 }), ent({ fase: 'perseguicao' }));
    const ferido = pose(vis({ t: 1, dor: 0.02 }), ent({ fase: 'perseguicao' }));
    const dif = Math.abs(ferido.troncoX - base.troncoX) + Math.abs(ferido.troncoZ - base.troncoZ);
    expect(dif).toBeGreaterThan(0.005);
    expect(dif).toBeLessThan(0.15);
    const passou = pose(vis({ t: 1, dor: DOR_VISUAL }), ent({ fase: 'perseguicao' }));
    expect(passou.troncoX).toBeCloseTo(base.troncoX);
  });

  it('determinística: mesmas entradas, mesma pose', () => {
    expect(pose(vis({ t: 2.5 }), ent({ fase: 'pausa' }))).toEqual(pose(vis({ t: 2.5 }), ent({ fase: 'pausa' })));
  });
});
