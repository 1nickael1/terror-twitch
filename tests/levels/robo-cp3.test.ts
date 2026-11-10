// Robô (C3.3): espera condições `tempo`, mata de novo corpos e o 049, usa terminais de perigo de área.
import { describe, expect, it } from 'vitest';
import { decidir, novoRobo, percorrer } from '../../src/levels/robo';
import { validarFase } from '../../src/levels/validar';
import type { GatilhoDef, LevelDef, PerigoArea } from '../../src/sim/fase';
import { centro } from '../../src/sim/grid';
import { PASSO, step } from '../../src/sim/step';
import { criarWorld } from '../../src/sim/world';
import { faseComChefe049, faseMinima } from '../sim/ajuda';

const livre = { minSegredos: 0, minCartoes: 0 };

/*
 * Necrotério: a porta A fica para trás ao pisar em [5, 1] (gatilho `necroterio` tranca A); uma gaveta
 * "abre" aos 2 s (reanimado na frente) e o elevador E abre aos 6 s. Saída em [10, 1].
 */
const NECROTERIO = '############\n#P.A....E.X#\n############';
const setPiece: GatilhoDef[] = [
  { id: 'necroterio', quando: { tipo: 'area', area: [5, 1, 1, 1] }, faz: [{ acao: 'porta', id: 'entrada', estado: 'trancar' }, { acao: 'mensagem', texto: 'Elevador chamado.' }] },
  { id: 'gaveta', quando: { tipo: 'tempo', apos: 2, desde: 'necroterio' }, faz: [{ acao: 'som', id: 'gaveta' }, { acao: 'spawn', inimigos: [{ em: [7, 1], tipo: 'reanimado' }] }] },
  { id: 'elevador', quando: { tipo: 'tempo', apos: 6, desde: 'necroterio' }, faz: [{ acao: 'som', id: 'elevador' }, { acao: 'porta', id: 'elevador', estado: 'abrir' }] },
];
function necroterio(): LevelDef {
  return faseMinima(NECROTERIO, {
    saida: [10, 1],
    portas: [{ id: 'entrada', em: 'A' }, { id: 'elevador', em: 'E', trancada: true }],
    gatilhos: setPiece,
  });
}

describe('robô: condição tempo', () => {
  it('a fase de teste é válida', () => {
    expect(validarFase(necroterio(), livre)).toEqual([]);
  });

  it('pisa na área que começa a contagem, espera o elevador abrir e chega à saída', () => {
    const r = percorrer(necroterio(), 60);
    expect(r).toMatchObject({ concluiu: true, motivo: 'saída' });
    expect(r.passos * PASSO).toBeGreaterThan(6);
  });

  it('enquanto espera, fica parado num ponto seguro (sem desvio de "preso")', () => {
    const w = criarWorld(necroterio());
    w.jogador.pos = centro([5, 1]);
    const r = novoRobo();
    for (let k = 0; k < 4 / PASSO; k++) {
      step(w, decidir(w, r), PASSO);
      for (const i of w.inimigos) i.modo = 'morto';   // o reanimado da gaveta
    }
    expect(w.gatilhosFeitos.has('necroterio')).toBe(true);
    expect(w.portas.find((p) => p.id === 'elevador')!.estado).toBe('trancada');
    const aqui = centro([5, 1]);
    expect(Math.hypot(w.jogador.pos.x - aqui.x, w.jogador.pos.z - aqui.z)).toBeLessThan(0.6);
    expect(r.semCaminho).toBe(0);
  });

  it('a espera sai do perigo de área: o ponto seguro fica fora da área', () => {
    // perigo de área sobre [5, 1] e [6, 1] (nunca acionado, mas a área conta como insegura)
    const uv: PerigoArea = { id: 'uv', tipo: 'ultravioleta', area: [5, 1, 2, 1], aviso: 1, duracao: 3, recarga: 4, danoChefePorSeg: 0.1, danoPorSeg: 10 };
    const f = faseComChefe049(`${NECROTERIO}\n#b#\n###`, { em: 'b', perigos: [uv] }, {
      saida: [10, 1],
      portas: [{ id: 'entrada', em: 'A' }, { id: 'elevador', em: 'E', trancada: true }],
      gatilhos: [...setPiece, { id: 'nunca', quando: { tipo: 'area', area: [9, 1, 1, 1] }, faz: [{ acao: 'perigo', id: 'uv' }] }],
    });
    const w = criarWorld(f);
    for (const i of w.inimigos) i.modo = 'morto';
    w.jogador.pos = centro([5, 1]);
    const r = novoRobo();
    for (let k = 0; k < 3 / PASSO; k++) {
      step(w, decidir(w, r), PASSO);
      for (const i of w.inimigos) i.modo = 'morto';
    }
    expect(w.gatilhosFeitos.has('necroterio')).toBe(true);
    expect(w.jogador.pos.x).toBeLessThan(5 * 2);   // saiu de [5, 1] para oeste (x < início da coluna 5)
  });
});

/*
 * Fase de teste com o 049: necrotério (tempo) e depois a arena com corpos. Entrar na arena tranca o
 * elevador e acorda o chefe; `chefe_morto` destranca a saída S.
 */
function faseDo049(): LevelDef {
  const planta = [
    '#################',
    '#P.A....E.......#',
    '#########.......#',
    '#########...b...#',
    '#########.......#',
    '###############S#',
    '###############X#',
    '#################',
  ].join('\n');
  const uv: PerigoArea = { id: 'uv', tipo: 'ultravioleta', area: [10, 2, 5, 3], aviso: 1, duracao: 4, recarga: 6, danoChefePorSeg: 0.075, danoPorSeg: 12 };
  return faseComChefe049(planta, { em: 'b', arena: [9, 1, 7, 4], retomada: 'b', perigos: [uv] }, {
    saida: [15, 6],
    portas: [{ id: 'entrada', em: 'A' }, { id: 'elevador', em: 'E', trancada: true }, { id: 'saida', em: 'S', trancada: true }],
    terminais: [{ id: 'tuv', em: [9, 0], rotulo: 'Esterilização' }],
    inimigos: [
      { em: [10, 3], tipo: 'reanimado', corpo: true },
      { em: [14, 2], tipo: 'reanimado', corpo: true },
      { em: [13, 4], tipo: 'reanimado_cirurgico' },
    ],
    gatilhos: [
      ...setPiece,
      { id: 'arena', quando: { tipo: 'area', area: [10, 1, 1, 1] }, faz: [{ acao: 'porta', id: 'elevador', estado: 'trancar' }, { acao: 'chefe' }] },
      { id: 'uv', quando: { tipo: 'terminal', id: 'tuv' }, faz: [{ acao: 'perigo', id: 'uv' }], umaVez: false },
      { id: 'fim', quando: { tipo: 'chefe_morto' }, faz: [{ acao: 'porta', id: 'saida', estado: 'destrancar' }] },
    ],
  });
}

describe('robô: fase com o 049', () => {
  it('a fase de teste é válida', () => {
    expect(validarFase(faseDo049(), livre)).toEqual([]);
  });

  it('sem inimigos, conclui (corpos, cirúrgico e chefe morrem a cada passo; espera o elevador)', () => {
    const r = percorrer(faseDo049(), 120);
    expect(r).toMatchObject({ concluiu: true, motivo: 'saída' });
    expect(r.passos * PASSO).toBeGreaterThan(6);
  });
});

describe('robô: terminal de perigo de área', () => {
  /*
   * O 049 fica numa sala selada (linha 3) coberta pela UV; o terminal t, na parede, aciona a UV. A
   * porta D só destranca com o chefe morto: com inimigos, o robô precisa usar o terminal até matá-lo.
   */
  const planta = ['#########', '#P....DX#', '##t######', '#..b....#', '#########'].join('\n');
  const uv: PerigoArea = { id: 'uv', tipo: 'ultravioleta', area: [1, 3, 7, 1], aviso: 0.5, duracao: 3, recarga: 3.5, danoChefePorSeg: 0.1, danoPorSeg: 10 };
  const f = faseComChefe049(planta, { em: 'b', perigos: [uv] }, {
    saida: [7, 1], legenda: { t: { tipo: 'parede' } },
    portas: [{ id: 'd', em: 'D', trancada: true }],
    terminais: [{ id: 't1', em: 't', rotulo: 'Esterilização' }],
    gatilhos: [
      { id: 'luz', quando: { tipo: 'terminal', id: 't1' }, faz: [{ acao: 'perigo', id: 'uv' }], umaVez: false },
      { id: 'fim', quando: { tipo: 'chefe_morto' }, faz: [{ acao: 'porta', id: 'd', estado: 'destrancar' }] },
    ],
  });

  it('com inimigos, aciona a UV quantas vezes precisar e sai com o chefe morto', () => {
    const r = percorrer(f, 90, { semInimigos: false });
    expect(r).toMatchObject({ concluiu: true, motivo: 'saída' });
    // 4 acionamentos (0,3 da vida cada), com a recarga de 3,5 s entre eles
    expect(r.passos * PASSO).toBeGreaterThan(3 * uv.recarga);
  });

  it('espera diante de perigo de área ligado na rota e segue se já está dentro dele', () => {
    const corredor = faseComChefe049('##########\n#P......X#\n##########\n#b#\n###', {
      em: 'b', perigos: [{ ...uv, area: [4, 1, 1, 1] }],
    }, { saida: [8, 1], gatilhos: [{ id: 'g', quando: { tipo: 'area', area: [8, 1, 1, 1] }, faz: [{ acao: 'perigo', id: 'uv' }] }] });
    const w = criarWorld(corredor);
    w.perigos[0].ativo = 2;
    w.jogador.pos = centro([3, 1]);
    expect(decidir(w, novoRobo()).frente).toBe(0);
    w.perigos[0].ativo = 0;
    w.perigos[0].aviso = 0.5;
    expect(decidir(w, novoRobo()).frente).toBe(0);
    w.jogador.pos = centro([4, 1]);
    expect(decidir(w, novoRobo()).frente).toBe(1);
  });
});
