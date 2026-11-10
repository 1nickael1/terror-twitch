// tests/sim/chefe049.test.ts — o chefe da fase 2 (inspirado no SCP-049): toque, reanimação, pressa, retomada (C3.2)
import { describe, expect, it } from 'vitest';
import { iaDeChefe } from '../../src/sim/ai/chefes';
import { TIPOS } from '../../src/sim/ai/tipos';
import { CHEFE_049, TENSAO } from '../../src/sim/balance';
import type { SimEvent } from '../../src/sim/eventos';
import type { PerigoArea } from '../../src/sim/fase';
import { centro } from '../../src/sim/grid';
import { PASSO, step } from '../../src/sim/step';
import { tensaoAlvo } from '../../src/sim/tension';
import { executar } from '../../src/sim/triggers';
import { ferirInimigo } from '../../src/sim/weapons';
import {
  INPUT_VAZIO, criarWorld, gravarCheckpoint, restaurarCheckpoint, type EstadoChefe049, type Inimigo, type World,
} from '../../src/sim/world';
import { faseComChefe049, porInimigo } from './ajuda';

const CORREDOR = `
  ######################
  #P...................#
  #....................#
  #....................#
  ######################
`;

const chefeDe = (w: World): Inimigo => w.inimigos.find((i) => i.id === w.chefe!.inimigoId)!;
/** O estado do chefe, estreitado para o 049. */
function c049(w: World): EstadoChefe049 {
  const c = w.chefe!;
  if (c.tipo !== 'entidade049') throw new Error('esperava o chefe 049');
  return c;
}
function rodar(w: World, segundos: number): SimEvent[] {
  const ev: SimEvent[] = [];
  const n = Math.round(segundos / PASSO);
  for (let k = 0; k < n; k++) ev.push(...step(w, INPUT_VAZIO, PASSO));
  return ev;
}
const tipos = (ev: readonly SimEvent[]) => ev.map((e) => e.tipo);

function mundo(em: [number, number] = [10, 2], extra: Parameters<typeof faseComChefe049>[2] = {}): World {
  const w = criarWorld(faseComChefe049(CORREDOR, { em }, { saida: [20, 3], ...extra }));
  w.jogador.colete = 0;
  return w;
}

/** Acordado e caminhando, com a reanimação a um passo de vencer. */
function prontoParaReanimar(w: World): void {
  const c = c049(w);
  c.fase = 'caminhando';
  c.reanimar = PASSO / 2;
}

describe('tipo e registro', () => {
  it('TIPOS.entidade049 com os números do adendo', () => {
    expect(TIPOS.entidade049).toMatchObject({
      arquetipo: 'avancador', vida: 1100, velocidade: 2.2, raio: 0.4, altura: 2.0, visao: 40, visaoEscuro: 40,
      cone: 2 * Math.PI, audicao: 0, dano: 85, alcanceAtaque: 1.4, cadencia: 2.2, preparo: 0.9, dor: 0,
      projetil: null, reanimavel: false,
    });
  });

  it('CHEFE_049 com as regras do adendo', () => {
    expect(CHEFE_049).toMatchObject({
      despertar: 2, intervaloReanimar: 8, primeiraReanimacao: 4, intervaloReanimarFerido: 5, alcanceReanimar: 14,
      reanimar: 1.6, levantar: 1.2, vidaReanimado: 0.6, maxLevantados: 4, longe: 10, tempoLonge: 6,
      velocidadeApressado: 4.5, apressado: 2.5, alcanceToque: 1.4, folgaToque: 1.25, passoMetros: 1.2,
    });
  });

  it('registrado em iaDeChefe; estado inicial inerte', () => {
    const ia = iaDeChefe('entidade049');
    expect(ia).not.toBeNull();
    expect(ia!.criarEstado(5)).toEqual({
      tipo: 'entidade049', inimigoId: 5, fase: 'inerte', timer: 0, naArena: false, passo: 0,
      reanimar: 0, corpoAlvo: null, longe: 0, levantados: [],
    });
    const w = mundo();
    expect(c049(w).fase).toBe('inerte');
    expect(chefeDe(w).vida).toBe(1100);
  });
});

describe('despertar', () => {
  it('inerte não desperta por distância nem por mira', () => {
    const w = mundo([2, 1]);   // a 2 m do jogador
    rodar(w, 3);
    expect(c049(w).fase).toBe('inerte');
    expect(chefeDe(w).modo).toBe('patrulha');
    expect(chefeDe(w).pos).toEqual(centro([2, 1]));
  });

  it('desperta pela ação chefe; 2 s despertando e depois caminhando com a primeira reanimação', () => {
    const w = mundo();
    expect(executar(w, { acao: 'chefe' })).toEqual([{ tipo: 'chefe_desperta' }]);
    expect(c049(w).fase).toBe('despertando');
    expect(executar(w, { acao: 'chefe' })).toEqual([]);
    rodar(w, 1.9);
    expect(c049(w).fase).toBe('despertando');
    expect(chefeDe(w).pos).toEqual(centro([10, 2]));
    expect(chefeDe(w).modo).toBe('suspeita');
    rodar(w, 0.2);
    expect(c049(w).fase).toBe('caminhando');
    expect(chefeDe(w).modo).toBe('perseguicao');
    expect(c049(w).reanimar).toBeGreaterThan(CHEFE_049.primeiraReanimacao - 0.2);
    expect(c049(w).reanimar).toBeLessThanOrEqual(CHEFE_049.primeiraReanimacao);
  });

  it('desperta ao levar dano', () => {
    const w = mundo();
    ferirInimigo(w, chefeDe(w), 10);
    const ev = rodar(w, PASSO);
    expect(tipos(ev)).toContain('chefe_desperta');
    expect(c049(w).fase).toBe('despertando');
  });
});

describe('caminhando e toque', () => {
  it('caminha até o jogador a 2,2 m/s', () => {
    const w = mundo([10, 1]);
    executar(w, { acao: 'chefe' });
    rodar(w, 2);
    const x0 = chefeDe(w).pos.x;
    rodar(w, 1);
    expect(x0 - chefeDe(w).pos.x).toBeCloseTo(2.2, 1);
  });

  it('toque: chefe_toque, 0,9 s de preparo e depois o dano configurado (85)', () => {
    const w = mundo([4, 1]);   // 6 m a leste do jogador
    executar(w, { acao: 'chefe' });
    let ev: SimEvent[] = [];
    for (let k = 0; k < 600 && !tipos(ev).includes('chefe_toque'); k++) ev = rodar(w, PASSO);
    expect(c049(w).fase).toBe('tocando');
    expect(chefeDe(w).modo).toBe('ataque');
    const pos = { ...chefeDe(w).pos };
    rodar(w, 0.85);
    expect(w.jogador.vida).toBe(100);
    expect(chefeDe(w).pos).toEqual(pos);   // parado no preparo
    const golpe = rodar(w, 0.1);
    expect(w.jogador.vida).toBe(100 - 85);
    expect(golpe.filter((e) => e.tipo === 'dano_jogador')).toHaveLength(1);
    expect(c049(w).fase).toBe('caminhando');
  });

  it('sair do alcance durante o preparo evita o toque', () => {
    const w = mundo([4, 1]);
    executar(w, { acao: 'chefe' });
    let ev: SimEvent[] = [];
    for (let k = 0; k < 600 && !tipos(ev).includes('chefe_toque'); k++) ev = rodar(w, PASSO);
    // o jogador recua 3 m para o sul, dentro do corredor (além de 1,4 × 1,25)
    w.jogador.pos = { x: chefeDe(w).pos.x, z: chefeDe(w).pos.z + 3 };
    expect(w.jogador.pos.z).toBeLessThan(8);   // linha 3 ainda é piso
    rodar(w, 1);
    expect(w.jogador.vida).toBe(100);
  });

  it('porta fechada bloqueia: o chefe não arromba nem abre', () => {
    const w = criarWorld(faseComChefe049(`
      ########
      #P..D.C#
      ########
    `, { em: 'C' }, { portas: [{ id: 'd', em: 'D' }], saida: [2, 1] }));
    executar(w, { acao: 'chefe' });
    const ev = rodar(w, 8);
    expect(w.portas[0].estado).toBe('fechada');
    expect(chefeDe(w).pos.x).toBeGreaterThan(9);   // do lado dele (a porta está em x 8..10)
    expect(tipos(ev)).not.toContain('chefe_arromba');
  });
});

describe('reanimação', () => {
  it('reanima o corpo reanimável mais próximo dentro do alcance', () => {
    const w = mundo([10, 2], {
      inimigos: [
        { em: [13, 2], tipo: 'reanimado', corpo: true },   // 6 m
        { em: [8, 2], tipo: 'reanimado', corpo: true },    // 4 m: o mais próximo
        { em: [18, 2], tipo: 'reanimado', corpo: true },   // 16 m: fora do alcance
      ],
    });
    const alvo = w.inimigos[1];
    prontoParaReanimar(w);
    const ev = rodar(w, PASSO);
    expect(ev).toContainEqual({ tipo: 'chefe_reanima', corpo: alvo.id });
    expect(c049(w).fase).toBe('reanimando');
    expect(c049(w).corpoAlvo).toBe(alvo.id);
    expect(chefeDe(w).modo).toBe('suspeita');
    const pos = { ...chefeDe(w).pos };
    rodar(w, 1.5);
    expect(alvo.modo).toBe('morto');
    expect(chefeDe(w).pos).toEqual(pos);   // parado reanimando
    const levanta = rodar(w, 0.15);
    expect(levanta).toContainEqual({ tipo: 'inimigo_levanta', id: alvo.id });
    expect(alvo.modo).toBe('levantando');
    expect(alvo.vida).toBeCloseTo(0.6 * 70, 6);
    expect(alvo.grupo).toBeNull();
    expect(c049(w).fase).toBe('caminhando');
    expect(c049(w).corpoAlvo).toBeNull();
    expect(c049(w).levantados).toEqual([alvo.id]);
    expect(c049(w).reanimar).toBeGreaterThan(CHEFE_049.intervaloReanimar - 0.2);
    // levantando: não anda nem ataca; depois persegue
    const posCorpo = { ...alvo.pos };
    rodar(w, 1.1);
    expect(alvo.modo).toBe('levantando');
    expect(alvo.pos).toEqual(posCorpo);
    rodar(w, 0.2);
    expect(alvo.modo).toBe('perseguicao');
    for (const outro of [w.inimigos[0], w.inimigos[2]]) expect(outro.modo).toBe('morto');
  });

  it('não reanima tipos não reanimáveis, corpos fora do alcance nem um chefe morto', () => {
    const w = mundo([10, 2], { inimigos: [{ em: [18, 2], tipo: 'reanimado', corpo: true }] });
    const func = porInimigo(w, 'funcionario', [11, 2]);
    ferirInimigo(w, func, 1000);
    const outroChefe = porInimigo(w, 'entidade049', [9, 2]);   // corpo de chefe a 2 m
    ferirInimigo(w, outroChefe, 5000);
    expect(outroChefe.modo).toBe('morto');
    prontoParaReanimar(w);
    const ev = rodar(w, PASSO);
    expect(tipos(ev)).not.toContain('chefe_reanima');
    expect(c049(w).fase).toBe('caminhando');
    expect(c049(w).reanimar).toBeCloseTo(CHEFE_049.intervaloReanimar, 6);
    expect(func.modo).toBe('morto');
    expect(outroChefe.modo).toBe('morto');
    expect(w.inimigos[0].modo).toBe('morto');
  });

  it('não reanima corpo atrás de parede; o mesmo corpo com passagem livre, sim', () => {
    const COM_PAREDE = `
      ######################
      #P...................#
      #.........#..........#
      #.........#..........#
      ######################
    `;
    for (const [planta, reanima] of [[COM_PAREDE, false], [CORREDOR, true]] as const) {
      const w = criarWorld(faseComChefe049(planta, { em: [8, 2] }, {
        saida: [20, 3], inimigos: [{ em: [11, 2], tipo: 'reanimado', corpo: true }],   // 6 m a leste
      }));
      prontoParaReanimar(w);
      expect([planta === COM_PAREDE, tipos(rodar(w, PASSO)).includes('chefe_reanima')]).toEqual([planta === COM_PAREDE, reanima]);
    }
  });

  it('não reanima corpo com o piso mais de SALTO acima ou abaixo', () => {
    const w = criarWorld(faseComChefe049(`
      ######################
      #P...................#
      #.........aaa........#
      #.........aaa........#
      ######################
    `, { em: [8, 2] }, {
      legenda: { a: { piso: 1.5, teto: 6 } },
      saida: [20, 3], inimigos: [{ em: [11, 2], tipo: 'reanimado', corpo: true }],
    }));
    prontoParaReanimar(w);
    expect(tipos(rodar(w, PASSO))).not.toContain('chefe_reanima');
  });

  it('o toque vence a reanimação: com o jogador perto, toca em vez de reanimar', () => {
    const w = mundo([2, 1], { inimigos: [{ em: [4, 2], tipo: 'reanimado', corpo: true }] });
    chefeDe(w).pos = { x: w.jogador.pos.x + 1.2, z: w.jogador.pos.z };
    prontoParaReanimar(w);
    const ev = rodar(w, PASSO);
    expect(tipos(ev)).toContain('chefe_toque');
    expect(tipos(ev)).not.toContain('chefe_reanima');
    expect(c049(w).fase).toBe('tocando');
  });

  it('ferido (vida < 50%), o intervalo cai para 5 s', () => {
    const w = mundo();
    chefeDe(w).vida = 500;
    prontoParaReanimar(w);
    rodar(w, PASSO);
    expect(c049(w).reanimar).toBeCloseTo(CHEFE_049.intervaloReanimarFerido, 6);
  });

  it('respeita maxLevantados (vivos levantados por ele)', () => {
    const w = mundo([10, 2], { inimigos: [{ em: [12, 3], tipo: 'reanimado', corpo: true }] });
    const corpo = w.inimigos[0];
    const vivos = [[9, 1], [9, 3], [11, 1], [11, 3]].map((p) => porInimigo(w, 'reanimado', p as [number, number]));
    c049(w).levantados.push(...vivos.map((i) => i.id));
    prontoParaReanimar(w);
    expect(tipos(rodar(w, PASSO))).not.toContain('chefe_reanima');
    expect(corpo.modo).toBe('morto');
    // um deles morre: abre vaga
    ferirInimigo(w, vivos[0], 1000);
    prontoParaReanimar(w);
    expect(tipos(rodar(w, PASSO))).toContain('chefe_reanima');
  });

  it('corpo (corpo: true) nasce morto e conta no total só ao levantar', () => {
    const w = mundo([10, 2], { inimigos: [{ em: [8, 2], tipo: 'reanimado', corpo: true }] });
    const corpo = w.inimigos[0];
    expect(corpo.modo).toBe('morto');
    expect(corpo.vida).toBe(0);
    expect(w.stats.totalInimigos).toBe(1);   // só o chefe
    prontoParaReanimar(w);
    rodar(w, 1.7);
    expect(corpo.modo).toBe('levantando');
    expect(corpo.contado).toBe(true);
    expect(w.stats.totalInimigos).toBe(2);
  });

  it('reanimado conta a morte só uma vez; levantar de novo não reconta no total', () => {
    const w = mundo([10, 2], { inimigos: [{ em: [8, 2], tipo: 'reanimado', corpo: true, grupo: 'g' }] });
    const corpo = w.inimigos[0];
    prontoParaReanimar(w);
    rodar(w, 1.7);
    expect(corpo.grupo).toBeNull();
    ferirInimigo(w, corpo, 1000);
    expect(w.stats.mortos).toBe(1);
    expect(corpo.jaMorreu).toBe(true);
    prontoParaReanimar(w);
    rodar(w, 1.7);
    expect(corpo.modo).toBe('levantando');
    expect(w.stats.totalInimigos).toBe(2);
    ferirInimigo(w, corpo, 1000);
    expect(w.stats.mortos).toBe(1);
    expect(w.stats.mortos).toBeLessThanOrEqual(w.stats.totalInimigos);
  });

  it('inimigo vivo reanimável morto e levantado: total não muda, morte conta uma vez', () => {
    const w = mundo();
    const r = porInimigo(w, 'reanimado', [8, 2]);
    expect(w.stats.totalInimigos).toBe(2);
    ferirInimigo(w, r, 1000);
    prontoParaReanimar(w);
    rodar(w, 1.7);
    expect(r.modo).toBe('levantando');
    expect(w.stats.totalInimigos).toBe(2);
    ferirInimigo(w, r, 1000);
    expect(w.stats.mortos).toBe(1);
  });

  it('perigo de área fere o reanimado; morto por ele, vira corpo e pode levantar de novo', () => {
    const UV: PerigoArea = {
      id: 'uv', tipo: 'ultravioleta', area: [7, 1, 3, 3], aviso: 0.5, duracao: 6, recarga: 10,
      danoChefePorSeg: 0.05, danoPorSeg: 40,
    };
    const w = criarWorld(faseComChefe049(CORREDOR, { em: [12, 2], perigos: [UV] }, {
      saida: [20, 3], inimigos: [{ em: [8, 2], tipo: 'reanimado', corpo: true }],
    }));
    const corpo = w.inimigos[0];
    prontoParaReanimar(w);
    rodar(w, 1.7);
    expect(corpo.modo).toBe('levantando');
    executar(w, { acao: 'perigo', id: 'uv' });
    rodar(w, 1);
    expect(corpo.vida).toBeLessThan(42);
    rodar(w, 3);
    expect(corpo.modo).toBe('morto');
    expect(w.stats.mortos).toBe(1);
    prontoParaReanimar(w);
    expect(tipos(rodar(w, PASSO))).toContain('chefe_reanima');
  });
});

describe('pressa', () => {
  it('jogador longe por mais de 6 s: apressado a 4,5 m/s por 2,5 s, depois caminhando com longe 0', () => {
    const w = mundo([19, 2]);
    executar(w, { acao: 'chefe' });
    rodar(w, 2);
    const antes = rodar(w, 5.9);
    expect(tipos(antes)).not.toContain('chefe_apressa');
    let ev: SimEvent[] = [];
    for (let k = 0; k < 60 && !tipos(ev).includes('chefe_apressa'); k++) ev = rodar(w, PASSO);
    expect(tipos(ev)).toContain('chefe_apressa');
    expect(c049(w).fase).toBe('apressado');
    expect(chefeDe(w).modo).toBe('perseguicao');
    const x0 = chefeDe(w).pos.x;
    rodar(w, 1);
    expect(x0 - chefeDe(w).pos.x).toBeCloseTo(4.5, 1);
    rodar(w, 1.55);
    expect(c049(w).fase).toBe('caminhando');
    expect(c049(w).longe).toBeLessThan(0.1);
  });

  it('chefe_passo a cada 1,2 m andados', () => {
    const w = mundo([19, 2]);
    executar(w, { acao: 'chefe' });
    rodar(w, 2);
    const ev = rodar(w, 2.4);   // ~5,3 m
    expect(ev.filter((e) => e.tipo === 'chefe_passo')).toHaveLength(4);
  });
});

describe('morte, tensão e restauro', () => {
  it('morre como o 096: fase morto e chefe_morto uma vez; a saída só conclui depois', () => {
    const w = mundo([10, 2], { saida: [1, 2] });
    executar(w, { acao: 'chefe' });
    w.jogador.pos = centro([1, 2]);
    rodar(w, PASSO);
    expect(w.estado).toBe('jogando');   // vivo, a saída não conclui
    ferirInimigo(w, chefeDe(w), 5000);
    const ev = rodar(w, PASSO);
    expect(tipos(ev).filter((t) => t === 'chefe_morto')).toHaveLength(1);
    expect(c049(w).fase).toBe('morto');
    rodar(w, PASSO);
    expect(w.estado).toBe('concluida');
  });

  it('tensão: acordado soma chefeAcordado; tocando, mais chefeInvestida', () => {
    const w = mundo();
    w.jogador.vida = 100;
    const c = c049(w);
    c.fase = 'caminhando';
    chefeDe(w).modo = 'perseguicao';
    const andando = tensaoAlvo(w);
    c.fase = 'tocando';
    chefeDe(w).modo = 'ataque';
    expect(tensaoAlvo(w) - andando).toBeCloseTo(TENSAO.chefeInvestida, 9);
    c.fase = 'inerte';
    chefeDe(w).modo = 'patrulha';
    expect(andando - tensaoAlvo(w)).toBeCloseTo(TENSAO.chefeAcordado + TENSAO.perseguicao, 9);
  });

  it('restauro com o chefe acordado: retomada, despertando 3 s, corpoAlvo nulo; corpo levantando volta a morto', () => {
    const w = criarWorld(faseComChefe049(CORREDOR, { em: [10, 2], retomada: [15, 3] }, {
      saida: [20, 3], inimigos: [{ em: [8, 2], tipo: 'reanimado', corpo: true }],
    }));
    const corpoId = w.inimigos[0].id;
    prontoParaReanimar(w);
    rodar(w, 1.7);
    expect(w.inimigos[0].modo).toBe('levantando');
    c049(w).corpoAlvo = 99;
    const mortos = w.stats.mortos;
    const total = w.stats.totalInimigos;
    gravarCheckpoint(w);
    restaurarCheckpoint(w);
    expect(chefeDe(w).pos).toEqual(centro([15, 3]));
    expect(c049(w)).toMatchObject({ fase: 'despertando', timer: 3, corpoAlvo: null });
    expect(chefeDe(w).modo).toBe('suspeita');
    const corpo = w.inimigos.find((i) => i.id === corpoId)!;
    expect(corpo.modo).toBe('morto');
    expect(corpo.vida).toBe(0);
    expect(w.stats.mortos).toBe(mortos);
    // levantava pela primeira vez (nunca morreu): a contagem do levantar é desfeita
    expect(corpo.contado).toBe(false);
    expect(w.stats.totalInimigos).toBe(total - 1);
    // e levantar de novo conta outra vez (o chefe volta para perto do corpo; a retomada fica a 14,1 m)
    chefeDe(w).pos = centro([10, 2]);
    prontoParaReanimar(w);
    rodar(w, 1.7);
    expect(corpo.modo).toBe('levantando');
    expect(w.stats.totalInimigos).toBe(total);
  });

  it('restauro com o chefe inerte não o move', () => {
    const w = criarWorld(faseComChefe049(CORREDOR, { em: [10, 2], retomada: [15, 3] }, { saida: [20, 3] }));
    gravarCheckpoint(w);
    restaurarCheckpoint(w);
    expect(chefeDe(w).pos).toEqual(centro([10, 2]));
    expect(c049(w).fase).toBe('inerte');
  });
});
