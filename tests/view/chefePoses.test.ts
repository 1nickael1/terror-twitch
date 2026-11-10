import { describe, expect, it } from 'vitest';
import {
  calcularPoseChefe, calcularPoseChefe049, GOLPE_CHEFE, type EntradaChefe, type EntradaChefe049,
} from '../../src/engine/view/chefePoses';
import { DOR_VISUAL, novaPose, type EstadoVisual, type Pose } from '../../src/engine/view/inimigosPoses';
import { ENTIDADE049, ENTIDADE096 } from '../../src/engine/view/moldeChefe';
import { CHEFE_049 } from '../../src/sim/balance';

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

describe('calcularPoseChefe049', () => {
  const B49 = ENTIDADE049.base;
  const e49 = (p: Partial<EntradaChefe049> = {}): EntradaChefe049 => ({ fase: 'inerte', timer: 0, preparo: 0.9, reanimar: 1.6, ...p });
  function pose49(v: EstadoVisual, e: EntradaChefe049): { p: Pose; aviso: number } {
    const p = novaPose();
    const aviso = calcularPoseChefe049(p, B49, v, e);
    return { p, aviso };
  }

  it('inerte: ereto, cabeça baixa, mãos juntas à frente', () => {
    const { p, aviso } = pose49(vis(), e49());
    expect(Math.abs(p.troncoX)).toBeLessThan(0.15);
    expect(p.cabecaX).toBeLessThan(-0.3);
    expect(p.bracoEZ).toBeGreaterThan(0);   // braço esquerdo vem para dentro
    expect(p.bracoDZ).toBeLessThan(0);
    expect(aviso).toBe(0);
  });

  it('despertando: ergue a cabeça e abre os braços até o fim', () => {
    const comeco = pose49(vis(), e49({ fase: 'despertando', timer: 2 })).p;
    const fim = pose49(vis(), e49({ fase: 'despertando', timer: 0 })).p;
    expect(fim.cabecaX).toBeGreaterThan(comeco.cabecaX + 0.3);
    expect(fim.bracoEZ).toBeLessThan(-0.3);
    expect(fim.bracoDZ).toBeGreaterThan(0.3);
  });

  it('despertando: a duração vem de CHEFE_049.despertar; no restauro (timer maior visto ao começar), dela', () => {
    const meio = pose49(vis(), e49({ fase: 'despertando', timer: CHEFE_049.despertar / 2 })).p;
    const comeco = pose49(vis(), e49({ fase: 'despertando', timer: CHEFE_049.despertar })).p;
    const fim = pose49(vis(), e49({ fase: 'despertando', timer: 0 })).p;
    expect(meio.cabecaX).toBeCloseTo((comeco.cabecaX + fim.cabecaX) / 2, 5);
    // restauro: começa com `retomada` s e já se mexe desde o início (não fica parado no primeiro segundo)
    const total = CHEFE_049.retomada;
    const a = pose49(vis(), e49({ fase: 'despertando', timer: total, despertarTotal: total })).p;
    const b = pose49(vis(), e49({ fase: 'despertando', timer: total - 0.5, despertarTotal: total })).p;
    expect(a.cabecaX).toBeCloseTo(comeco.cabecaX, 5);
    expect(b.cabecaX).toBeGreaterThan(a.cabecaX);
  });

  it('tocando: o braço direito se estende ao jogador e o aviso (palma) cresce com o preparo', () => {
    const comeco = pose49(vis(), e49({ fase: 'tocando', timer: 0.9 }));
    const meio = pose49(vis(), e49({ fase: 'tocando', timer: 0.45 }));
    const fim = pose49(vis(), e49({ fase: 'tocando', timer: 0 }));
    expect(comeco.aviso).toBeCloseTo(0);
    expect(meio.aviso).toBeCloseTo(0.5);
    expect(fim.aviso).toBe(1);
    expect(fim.p.bracoDX).toBeGreaterThan(1.4);
    expect(fim.p.bracoDX).toBeGreaterThan(comeco.p.bracoDX + 1);
    expect(fim.p.bracoEX).toBeLessThan(0.5);   // só um braço
  });

  it('reanimando: os dois braços erguidos', () => {
    const { p, aviso } = pose49(vis(), e49({ fase: 'reanimando', timer: 0.8 }));
    expect(p.bracoEX).toBeGreaterThan(2.2);
    expect(p.bracoDX).toBeGreaterThan(2.2);
    expect(aviso).toBe(0);
    // no começo os braços ainda sobem
    const comeco = pose49(vis(), e49({ fase: 'reanimando', timer: 1.6 })).p;
    expect(comeco.bracoEX).toBeLessThan(1);
  });

  it('apressado inclina mais e dá passada mais larga que caminhando', () => {
    const v = vis({ vel: 4, passada: Math.PI / 2 });
    const andando = pose49(vis({ vel: 2.2, passada: Math.PI / 2 }), e49({ fase: 'caminhando' })).p;
    const pressa = pose49(v, e49({ fase: 'apressado' })).p;
    expect(pressa.troncoX).toBeLessThan(andando.troncoX - 0.2);
    expect(Math.abs(pressa.pernaEX)).toBeGreaterThan(Math.abs(andando.pernaEX));
  });

  it('morto: de bruços no chão', () => {
    expect(pose49(vis(), e49({ fase: 'morto' })).p.corpoX).toBeCloseTo(-Math.PI / 2, 1);
  });

  it('determinística', () => {
    expect(pose49(vis({ t: 3.1 }), e49({ fase: 'reanimando', timer: 1 }))).toEqual(pose49(vis({ t: 3.1 }), e49({ fase: 'reanimando', timer: 1 })));
  });
});
