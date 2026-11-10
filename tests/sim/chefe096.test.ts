// tests/sim/chefe096.test.ts — o chefe da fase 1 (inspirado no SCP-096)
import { describe, expect, it } from 'vitest';
import { avancarInimigos } from '../../src/sim/ai/comum';
import { CHEFE_096 } from '../../src/sim/balance';
import { solidoDe } from '../../src/sim/doors';
import type { SimEvent } from '../../src/sim/eventos';
import type { PerigoDef } from '../../src/sim/fase';
import { centro, coordDe } from '../../src/sim/grid';
import { PASSO, step } from '../../src/sim/step';
import { tensaoAlvo } from '../../src/sim/tension';
import { executar } from '../../src/sim/triggers';
import { ferirInimigo } from '../../src/sim/weapons';
import {
  INPUT_VAZIO, criarWorld, gravarCheckpoint, restaurarCheckpoint, type InputFrame, type Inimigo, type World,
} from '../../src/sim/world';
import { faseComChefe } from './ajuda';

const LESTE = -Math.PI / 2;   // frente = (1, 0)
const OESTE = Math.PI / 2;    // frente = (-1, 0)

const chefeDe = (w: World): Inimigo => w.inimigos.find((i) => i.id === w.chefe!.inimigoId)!;
function rodar(w: World, segundos: number, input: InputFrame | ((k: number) => InputFrame) = INPUT_VAZIO): SimEvent[] {
  const ev: SimEvent[] = [];
  const n = Math.round(segundos / PASSO);
  for (let k = 0; k < n; k++) ev.push(...step(w, typeof input === 'function' ? input(k) : input, PASSO));
  return ev;
}
const tipos = (ev: readonly SimEvent[]) => ev.map((e) => e.tipo);

const CORREDOR = `
  ######################
  #P...................#
  #....................#
  #....................#
  ######################
`;
const COM_PAREDE = `
  ######################
  #P.........#.........#
  #..........#.........#
  #..........#.........#
  ######################
`;

describe('criação', () => {
  it('cria o inimigo do chefe, conta no total e começa inerte', () => {
    const w = criarWorld(faseComChefe(CORREDOR, { em: [18, 1], yaw: 1 }, { saida: [20, 3] }));
    expect(w.chefe).not.toBeNull();
    const c = chefeDe(w);
    expect(c.tipo).toBe('entidade096');
    expect(c.vida).toBe(900);
    expect(c.yaw).toBe(1);
    expect(w.chefe!.fase).toBe('inerte');
    expect(w.stats.totalInimigos).toBe(1);
    expect(w.perigos).toEqual([]);
  });

  it('sem chefe, chefe é null e perigos vazio', () => {
    const w = criarWorld(faseComChefe(CORREDOR, { em: [18, 1] }, { chefe: undefined }));
    expect(w.chefe).toBeNull();
    expect(w.perigos).toEqual([]);
  });
});

describe('despertar', () => {
  it('desperta por mira acumulada (1,5 s), uma vez', () => {
    const w = criarWorld(faseComChefe(CORREDOR, { em: [18, 1] }, { spawnYaw: LESTE, saida: [20, 3] }));
    const antes = rodar(w, 1.4);
    expect(w.chefe!.fase).toBe('inerte');
    expect(tipos(antes)).not.toContain('chefe_desperta');
    const depois = rodar(w, 0.2);
    expect(w.chefe!.fase).toBe('despertando');
    expect(tipos(depois).filter((t) => t === 'chefe_desperta')).toHaveLength(1);
  });

  it('a mira acumula mesmo desviando no meio', () => {
    const w = criarWorld(faseComChefe(CORREDOR, { em: [18, 1] }, { spawnYaw: LESTE, saida: [20, 3] }));
    rodar(w, 1.0);
    w.jogador.yaw = OESTE;
    rodar(w, 1.0);
    expect(w.chefe!.fase).toBe('inerte');
    w.jogador.yaw = LESTE;
    rodar(w, 0.6);
    expect(w.chefe!.fase).toBe('despertando');
  });

  it('não desperta sem linha de visão', () => {
    const w = criarWorld(faseComChefe(COM_PAREDE, { em: [18, 1] }, { spawnYaw: LESTE, saida: [20, 3] }));
    rodar(w, 3);
    expect(w.chefe!.fase).toBe('inerte');
    expect(w.chefe!.olhar).toBe(0);
  });

  it('desperta com o jogador a até 8 m, mesmo sem olhar', () => {
    const longe = criarWorld(faseComChefe(CORREDOR, { em: [6, 1] }, { spawnYaw: OESTE, saida: [20, 3] }));
    rodar(longe, 0.5);
    expect(longe.chefe!.fase).toBe('inerte');
    const perto = criarWorld(faseComChefe(CORREDOR, { em: [4, 1] }, { spawnYaw: OESTE, saida: [20, 3] }));
    expect(tipos(rodar(perto, PASSO))).toContain('chefe_desperta');
    expect(perto.chefe!.fase).toBe('despertando');
  });

  it('desperta ao levar dano', () => {
    const w = criarWorld(faseComChefe(CORREDOR, { em: [18, 1] }, { spawnYaw: OESTE, saida: [20, 3] }));
    ferirInimigo(w, chefeDe(w), 5);
    const ev = rodar(w, PASSO);
    expect(tipos(ev)).toContain('chefe_desperta');
    expect(w.chefe!.fase).toBe('despertando');
    expect(chefeDe(w).modo).toBe('suspeita');   // derivado da fase, nunca 'dor'
  });

  it('despertando fica parado 2,5 s virando para o jogador e depois persegue', () => {
    const w = criarWorld(faseComChefe(CORREDOR, { em: [12, 1], yaw: OESTE + Math.PI }, { spawnYaw: OESTE, saida: [20, 3] }));
    ferirInimigo(w, chefeDe(w), 5);
    rodar(w, PASSO);
    const pos = { ...chefeDe(w).pos };
    rodar(w, 2.3);
    expect(chefeDe(w).pos).toEqual(pos);
    expect(w.chefe!.fase).toBe('despertando');
    rodar(w, 0.3);
    expect(w.chefe!.fase).toBe('perseguicao');
    expect(Math.abs(Math.cos(chefeDe(w).yaw - OESTE))).toBeGreaterThan(0.99);   // virado para o oeste (jogador)
    rodar(w, 0.5);
    expect(chefeDe(w).pos.x).toBeLessThan(pos.x - 2);
  });
});

describe('perseguição', () => {
  it('porta trancada atrasa 3 s e depois abre mesmo trancada', () => {
    const w = criarWorld(faseComChefe(`
      ######################
      #C......D...........P#
      ######################
    `, { em: 'C' }, { portas: [{ id: 'd', em: 'D', trancada: true }], saida: [20, 1] }));
    // a saída está no P, mas com o chefe vivo a fase não conclui
    w.chefe!.fase = 'perseguicao';
    let tArromba = -1;
    let tAbre = -1;
    for (let k = 0; k < 60 * 8 && tAbre < 0; k++) {
      for (const e of step(w, INPUT_VAZIO, PASSO)) {
        if (e.tipo === 'chefe_arromba') {
          expect(e.porta).toBe('d');
          tArromba = w.t;
        }
        if (e.tipo === 'porta' && e.id === 'd' && e.estado === 'abrindo') tAbre = w.t;
      }
      if (tArromba >= 0 && tAbre < 0) expect(w.chefe!.fase).toBe('arrombando');
    }
    expect(tArromba).toBeGreaterThan(0);
    expect(tAbre - tArromba).toBeCloseTo(CHEFE_096.arrombar, 1);
    expect(chefeDe(w).modo).not.toBe('ataque');
    rodar(w, 1.5);
    expect(coordDe(chefeDe(w).pos)[0]).toBeGreaterThan(8);
  });

  it('a até 1,3 m golpeia com preparo e cadência, dano 70', () => {
    const w = criarWorld(faseComChefe(CORREDOR, { em: [3, 1] }, { spawnYaw: OESTE, saida: [20, 3] }));
    w.chefe!.fase = 'perseguicao';
    w.jogador.vida = 1000;
    const ev = rodar(w, 1.2);
    expect(tipos(ev)).toContain('inimigo_ataque');
    const danos = ev.filter((e) => e.tipo === 'dano_jogador');
    expect(danos.length).toBeGreaterThanOrEqual(1);
    expect(danos[0]).toMatchObject({ quantia: 70 });
  });
});

describe('arena', () => {
  const ARENA = `
    ############
    #P.........#
    #..........#
    #..........#
    ############
  `;

  it('entrar na arena marca naArena e começa uma investida na direção do jogador', () => {
    const w = criarWorld(faseComChefe(ARENA, { em: [8, 2], arena: [6, 1, 5, 3] }, { saida: [10, 3] }));
    w.chefe!.fase = 'perseguicao';
    const ev = rodar(w, PASSO * 2);
    expect(w.chefe!.naArena).toBe(true);
    expect(tipos(ev)).toContain('chefe_investida');
    expect(w.chefe!.fase).toBe('investida');
    expect(w.chefe!.investida!.x).toBeLessThan(0);   // jogador a oeste
    expect(tensaoAlvo(w)).toBeGreaterThanOrEqual(0.5 + 0.2);
  });

  it('investida para em parede e entra em pausa', () => {
    const w = criarWorld(faseComChefe(ARENA, { em: [5, 2], arena: [1, 1, 10, 3] }, { saida: [10, 3] }));
    const c = w.chefe!;
    c.naArena = true;
    c.fase = 'investida';
    c.timer = CHEFE_096.investidaMax;
    c.investida = { x: 0, z: 1 };   // para o sul, contra a parede da linha 4
    rodar(w, 0.4);
    expect(c.fase).toBe('pausa');
    expect(c.investida).toBeNull();
    expect(chefeDe(w).pos.z).toBeGreaterThan(7.4);
    expect(chefeDe(w).pos.z).toBeLessThan(8);
    rodar(w, CHEFE_096.pausa - 0.4 - 0.1);
    expect(c.fase).toBe('pausa');
  });

  it('investida que passa a 1,3 m do jogador o golpeia', () => {
    const w = criarWorld(faseComChefe(ARENA, { em: [6, 1], arena: [1, 1, 10, 3] }, { saida: [10, 3] }));
    const c = w.chefe!;
    c.naArena = true;
    c.fase = 'investida';
    c.timer = CHEFE_096.investidaMax;
    c.investida = { x: -1, z: 0 };
    w.jogador.vida = 1000;
    const ev = rodar(w, 0.7);
    expect(ev.filter((e) => e.tipo === 'dano_jogador')).toHaveLength(1);
    expect(c.fase).toBe('pausa');
  });
});

describe('comporta', () => {
  const comporta: PerigoDef = { id: 'c1', tipo: 'comporta', area: [5, 1, 1, 3], duracao: 2, recarga: 5, danoChefe: 0.25, danoComum: 30 };
  const SALA = `
    ############
    #P.........#
    #..........#
    #..........#
    ############
  `;

  it('tira danoChefe × vidaMax do chefe no vão e respeita a recarga', () => {
    const w = criarWorld(faseComChefe(SALA, { em: [5, 2], perigos: [comporta] }, { saida: [10, 3] }));
    w.jogador.vida = 10000;   // o chefe acorda com o golpe e vem atrás do jogador
    expect(w.perigos).toEqual([{ id: 'c1', ativo: 0, recarga: 0 }]);
    const ev = executar(w, { acao: 'perigo', id: 'c1' });
    expect(ev).toContainEqual({ tipo: 'perigo', id: 'c1', estado: 'fecha' });
    expect(chefeDe(w).vida).toBe(900 - 225);
    expect(solidoDe(w)(5, 1)).toBe(true);
    expect(solidoDe(w)(6, 1)).toBe(false);

    const neg = executar(w, { acao: 'perigo', id: 'c1' });
    expect(neg).toContainEqual({ tipo: 'perigo', id: 'c1', estado: 'recarregando' });
    expect(neg).toContainEqual({ tipo: 'mensagem', texto: 'Comporta recarregando.' });
    expect(chefeDe(w).vida).toBe(900 - 225);

    const abre = rodar(w, 2.05);
    expect(abre).toContainEqual({ tipo: 'perigo', id: 'c1', estado: 'abre' });
    expect(solidoDe(w)(5, 1)).toBe(false);
    rodar(w, 3);
    w.chefe!.fase = 'pausa';   // segura o chefe parado no vão para o segundo golpe
    chefeDe(w).pos = centro([5, 2]);
    executar(w, { acao: 'perigo', id: 'c1' });
    expect(chefeDe(w).vida).toBe(900 - 450);
  });

  it('fere o jogador e inimigos comuns no vão, uma vez por acionamento', () => {
    const w = criarWorld(faseComChefe(SALA, { em: [9, 2], perigos: [{ ...comporta, area: [1, 1, 1, 3] }] }, { saida: [10, 3] }));
    const ev = executar(w, { acao: 'perigo', id: 'c1' });
    expect(ev.filter((e) => e.tipo === 'dano_jogador')).toEqual([expect.objectContaining({ quantia: 30 })]);
    expect(w.jogador.vida).toBe(70);
    expect(chefeDe(w).vida).toBe(900);   // fora do vão
    rodar(w, 0.5);
    expect(w.jogador.vida).toBe(70);
  });

  it('ação perigo por gatilho', () => {
    const w = criarWorld(faseComChefe(SALA, { em: [5, 2], perigos: [comporta] }, {
      saida: [10, 3], gatilhos: [{ id: 'g', quando: { tipo: 'area', area: [1, 1, 1, 1] }, faz: [{ acao: 'perigo', id: 'c1' }] }],
    }));
    const ev = rodar(w, PASSO);
    expect(ev).toContainEqual({ tipo: 'perigo', id: 'c1', estado: 'fecha' });
  });
});

describe('checkpoint', () => {
  it('restauro com o chefe acordado o põe na retomada, despertando com 3 s', () => {
    const w = criarWorld(faseComChefe(CORREDOR, { em: [18, 1], retomada: [15, 3], perigos: [
      { id: 'c1', tipo: 'comporta', area: [10, 1, 1, 3], duracao: 2, recarga: 5, danoChefe: 0.1, danoComum: 10 },
    ] }, { spawnYaw: OESTE, saida: [20, 3] }));
    const c = w.chefe!;
    c.fase = 'arrombando';
    c.portaAlvo = 'x';
    c.investida = { x: 1, z: 0 };
    w.perigos[0].recarga = 4;
    gravarCheckpoint(w);
    chefeDe(w).pos = centro([3, 3]);
    w.perigos[0].recarga = 0;
    restaurarCheckpoint(w);
    expect(chefeDe(w).pos).toEqual(centro([15, 3]));
    expect(w.chefe).toMatchObject({ fase: 'despertando', timer: 3, portaAlvo: null, investida: null });
    expect(w.perigos[0].recarga).toBe(4);
    expect(chefeDe(w).modo).toBe('suspeita');
  });

  it('restauro com o chefe já morto (fase ainda não atualizada) não o ressuscita', () => {
    const w = criarWorld(faseComChefe(CORREDOR, { em: [18, 1], retomada: [15, 3] }, { spawnYaw: OESTE, saida: [20, 3] }));
    w.chefe!.fase = 'perseguicao';
    ferirInimigo(w, chefeDe(w), 10000);
    gravarCheckpoint(w);
    restaurarCheckpoint(w);
    expect(chefeDe(w).modo).toBe('morto');
    expect(chefeDe(w).pos).toEqual(centro([18, 1]));
    expect(tipos(rodar(w, PASSO))).toContain('chefe_morto');
  });

  it('restauro com o chefe inerte o deixa onde estava', () => {
    const w = criarWorld(faseComChefe(CORREDOR, { em: [18, 1], retomada: [15, 3] }, { spawnYaw: OESTE, saida: [20, 3] }));
    restaurarCheckpoint(w);
    expect(chefeDe(w).pos).toEqual(centro([18, 1]));
    expect(w.chefe!.fase).toBe('inerte');
  });
});

describe('morte e conclusão', () => {
  it('a saída não conclui com o chefe vivo; morto, conclui', () => {
    const w = criarWorld(faseComChefe(CORREDOR, { em: [18, 1] }, { spawnYaw: OESTE, saida: [1, 1] }));
    rodar(w, 0.5);
    expect(w.estado).toBe('jogando');
    ferirInimigo(w, chefeDe(w), 10000);
    const ev = rodar(w, PASSO);
    expect(tipos(ev)).toEqual(expect.arrayContaining(['chefe_morto', 'fase_concluida']));
    expect(w.chefe!.fase).toBe('morto');
    expect(w.estado).toBe('concluida');
  });

  it('o chefe morre no tiro com munição suficiente, com chefe_morto uma vez', () => {
    const w = criarWorld(faseComChefe(`
      #######
      #.Pg.C#
      #######
    `, { em: 'C' }, { legenda: { g: { tipo: 'grade' } }, spawnYaw: LESTE, saida: [1, 1] }));
    w.jogador.municao.balas = 120;
    const ev = rodar(w, 25, (k) => ({ ...INPUT_VAZIO, atirar: k % 2 === 0 }));
    expect(tipos(ev).filter((t) => t === 'chefe_morto')).toHaveLength(1);
    expect(w.chefe!.fase).toBe('morto');
    expect(chefeDe(w).modo).toBe('morto');
    expect(w.stats.mortos).toBe(1);
    expect(w.estado).toBe('jogando');
  });

  it('chefe morto não se move nem fere', () => {
    const w = criarWorld(faseComChefe(CORREDOR, { em: [3, 1] }, { spawnYaw: OESTE, saida: [20, 3] }));
    ferirInimigo(w, chefeDe(w), 10000);
    const pos = { ...chefeDe(w).pos };
    const ev: SimEvent[] = [];
    for (let k = 0; k < 120; k++) ev.push(...avancarInimigos(w, [], PASSO));
    expect(chefeDe(w).pos).toEqual(pos);
    expect(tipos(ev).filter((t) => t === 'chefe_morto')).toHaveLength(1);
    expect(tipos(ev)).not.toContain('dano_jogador');
  });
});

describe('gatilhos do chefe', () => {
  it('chefe_vida vale abaixo da fração; chefe_morto só com ele morto; ação chefe desperta', () => {
    const w = criarWorld(faseComChefe(CORREDOR, { em: [18, 1] }, {
      spawnYaw: OESTE, saida: [20, 3],
      gatilhos: [
        { id: 'meia', quando: { tipo: 'chefe_vida', abaixo: 0.5 }, faz: [{ acao: 'mensagem', texto: 'meia' }] },
        { id: 'fim', quando: { tipo: 'chefe_morto' }, faz: [{ acao: 'mensagem', texto: 'fim' }] },
      ],
    }));
    expect(executar(w, { acao: 'chefe' })).toContainEqual({ tipo: 'chefe_desperta' });
    expect(w.chefe!.fase).toBe('despertando');
    expect(executar(w, { acao: 'chefe' })).toEqual([]);
    expect(tipos(rodar(w, PASSO))).not.toContain('gatilho');
    chefeDe(w).vida = 400;
    expect(rodar(w, PASSO)).toContainEqual({ tipo: 'gatilho', id: 'meia' });
    ferirInimigo(w, chefeDe(w), 10000);
    expect(rodar(w, PASSO)).toContainEqual({ tipo: 'gatilho', id: 'fim' });
  });
});

describe('tensão', () => {
  it('chefe acordado soma 0,5; inerte e morto não', () => {
    const w = criarWorld(faseComChefe(CORREDOR, { em: [18, 1] }, { spawnYaw: OESTE, saida: [20, 3] }));
    expect(tensaoAlvo(w)).toBe(0);
    w.chefe!.fase = 'pausa';
    chefeDe(w).modo = 'suspeita';
    expect(tensaoAlvo(w)).toBeCloseTo(0.5 + 0.08);
    w.chefe!.fase = 'morto';
    chefeDe(w).modo = 'morto';
    expect(tensaoAlvo(w)).toBe(0);
  });
});

describe('correção 1 da revisão', () => {
  const ARENA = `
    ############
    #P.........#
    #..........#
    #..........#
    ############
  `;

  it('jogador atrás de janela: não entra em ciclo de investida e pausa', () => {
    const w = criarWorld(faseComChefe(`
      ############
      #P.j.......#
      ############
    `, { em: [8, 1], arena: [1, 1, 10, 1] }, { legenda: { j: { tipo: 'janela' } }, spawnYaw: OESTE, saida: [10, 1] }));
    w.chefe!.fase = 'perseguicao';
    w.jogador.vida = 1000;
    const ev = rodar(w, 6);
    expect(tipos(ev)).not.toContain('chefe_investida');
    expect(w.chefe!.fase).not.toBe('pausa');
    // sem rota até o jogador: vai à célula alcançável mais próxima dele, colado na janela
    expect(coordDe(chefeDe(w).pos)).toEqual([4, 1]);
  });

  it('investida diagonal contra a parede para no contato', () => {
    const w = criarWorld(faseComChefe(ARENA, { em: [5, 2], arena: [1, 1, 10, 3] }, { saida: [10, 3] }));
    const c = w.chefe!;
    c.naArena = true;
    c.fase = 'investida';
    c.timer = CHEFE_096.investidaMax;
    c.investida = { x: Math.SQRT1_2, z: Math.SQRT1_2 };   // 45°, rumo à parede sul
    w.jogador.pos = centro([1, 1]);
    rodar(w, 0.4);
    expect(c.fase).toBe('pausa');
    // bateu a z ≈ 7,55 depois de ~2,55 m em z; não escorregou pela parede até o fim dos 1,6 s
    expect(chefeDe(w).pos.x).toBeLessThan(11 + 3.5);
  });

  it('chefe sem rota até o jogador num patamar espera na célula alcançável mais próxima, virado para ele', () => {
    const w = criarWorld(faseComChefe(`
      ###########
      #.........#
      #.....BBB.#
      #C....BPB.#
      #.....BBB.#
      #.........#
      ###########
    `, { em: 'C' }, { legenda: { B: { piso: 1.5 }, P: { piso: 1.5 } }, spawnYaw: OESTE, saida: [9, 1] }));
    w.chefe!.fase = 'perseguicao';
    rodar(w, 3);
    expect(coordDe(chefeDe(w).pos)).toEqual([5, 3]);
    expect(-Math.sin(chefeDe(w).yaw)).toBeGreaterThan(0.99);   // olhando para o leste
    expect(w.chefe!.fase).toBe('perseguicao');
  });

  it('a mira conta o pitch: olhando para o chão, olhar não acumula', () => {
    const w = criarWorld(faseComChefe(CORREDOR, { em: [18, 1] }, { spawnYaw: LESTE, saida: [20, 3] }));
    w.jogador.pitch = -1.2;
    rodar(w, 2);
    expect(w.chefe!.olhar).toBe(0);
    expect(w.chefe!.fase).toBe('inerte');
  });

  it('arrombando sai cedo se outro abriu a porta', () => {
    const w = criarWorld(faseComChefe(`
      ######################
      #C......D...........P#
      ######################
    `, { em: 'C' }, { portas: [{ id: 'd', em: 'D', trancada: true }], saida: [20, 1] }));
    const c = w.chefe!;
    c.fase = 'arrombando';
    c.timer = CHEFE_096.arrombar;
    c.portaAlvo = 'd';
    const p = w.portas[0];
    p.estado = 'aberta';
    p.abertura = 1;
    const ev = rodar(w, PASSO);
    expect(c.fase).toBe('perseguicao');
    expect(c.portaAlvo).toBeNull();
    expect(tipos(ev)).not.toContain('porta');
  });

  it('morto pela comporta, a fase vira morto no próprio acionamento (chefe_morto uma vez)', () => {
    const w = criarWorld(faseComChefe(ARENA, { em: [5, 2], perigos: [
      { id: 'c1', tipo: 'comporta', area: [5, 1, 1, 3], duracao: 2, recarga: 5, danoChefe: 0.25, danoComum: 30 },
    ] }, { spawnYaw: OESTE, saida: [10, 3] }));
    chefeDe(w).vida = 10;
    const ev = executar(w, { acao: 'perigo', id: 'c1' });
    expect(tipos(ev)).toContain('chefe_morto');
    expect(w.chefe!.fase).toBe('morto');
    expect(tensaoAlvo(w)).toBe(0);
    expect(tipos(rodar(w, PASSO))).not.toContain('chefe_morto');
  });
});

describe('lote final do CP2: velocidade, preparo da investida e passos', () => {
  const LONGO = `
    ##############################
    #P...........................#
    #............................#
    #............................#
    ##############################
  `;

  it(`na perseguição corre a CHEFE_096.velocidadePerseguicao (${CHEFE_096.velocidadePerseguicao} m/s)`, () => {
    const w = criarWorld(faseComChefe(LONGO, { em: [27, 2] }, { saida: [1, 3] }));
    const c = w.chefe!;
    c.fase = 'perseguicao';
    w.jogador.vida = 1e6;
    const x0 = chefeDe(w).pos.x;
    rodar(w, 1);
    const andou = x0 - chefeDe(w).pos.x;
    expect(andou).toBeGreaterThan(CHEFE_096.velocidadePerseguicao * 0.95);
    expect(andou).toBeLessThan(CHEFE_096.velocidadePerseguicao * 1.05);
    expect(CHEFE_096.velocidadePerseguicao).toBeGreaterThanOrEqual(10);
    expect(CHEFE_096.velocidadePerseguicao).toBeLessThanOrEqual(12);
  });

  it('toda investida começa com CHEFE_096.preparoInvestida s parado, com chefe_investida no início do preparo', () => {
    const w = criarWorld(faseComChefe(`
      ############
      #P.........#
      #..........#
      #..........#
      ############
    `, { em: [8, 2], arena: [6, 1, 5, 3] }, { saida: [10, 3] }));
    w.chefe!.fase = 'perseguicao';
    const ev = rodar(w, PASSO * 2);
    expect(tipos(ev).filter((t) => t === 'chefe_investida')).toHaveLength(1);
    expect(w.chefe!.fase).toBe('investida');
    const pos = { ...chefeDe(w).pos };
    rodar(w, CHEFE_096.preparoInvestida - PASSO * 3);
    expect(chefeDe(w).pos).toEqual(pos);
    expect(w.chefe!.fase).toBe('investida');
    rodar(w, 0.2);
    expect(chefeDe(w).pos.x).toBeLessThan(pos.x - 1);
  });

  it('emite chefe_passo a cada CHEFE_096.passoMetros andados na perseguição, na posição dele', () => {
    const w = criarWorld(faseComChefe(LONGO, { em: [27, 2] }, { saida: [1, 3] }));
    w.chefe!.fase = 'perseguicao';
    w.jogador.vida = 1e6;
    const ev = rodar(w, 1);
    const passos = ev.filter((e) => e.tipo === 'chefe_passo');
    const esperado = Math.floor(CHEFE_096.velocidadePerseguicao / CHEFE_096.passoMetros);
    expect(passos.length).toBeGreaterThanOrEqual(esperado - 1);
    expect(passos.length).toBeLessThanOrEqual(esperado + 1);
    const p = passos[0] as Extract<SimEvent, { tipo: 'chefe_passo' }>;
    expect(p.pos.x).toBeLessThan(27 * 2 + 1);
    expect(p.pos.z).toBeCloseTo(2 * 2 + 1, 0);
  });

  it('também emite passos na investida; parado (inerte, despertando, preparo) não', () => {
    const w = criarWorld(faseComChefe(LONGO, { em: [20, 2], arena: [1, 1, 28, 3] }, { saida: [1, 3] }));
    expect(rodar(w, 0.5).some((e) => e.tipo === 'chefe_passo')).toBe(false);   // inerte, longe
    const c = w.chefe!;
    c.naArena = true;
    c.fase = 'investida';
    c.timer = CHEFE_096.investidaMax + CHEFE_096.preparoInvestida;
    c.investida = { x: -1, z: 0 };
    w.jogador.vida = 1e6;
    expect(rodar(w, CHEFE_096.preparoInvestida - PASSO).some((e) => e.tipo === 'chefe_passo')).toBe(false);
    expect(rodar(w, 0.5).filter((e) => e.tipo === 'chefe_passo').length).toBeGreaterThanOrEqual(2);
  });
});
