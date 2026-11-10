// tests/audio/regras.test.ts
import { describe, expect, it } from 'vitest';
import {
  audivel, lamentoDoChefe, LimitadorSons, ocluido, RegistroVozes, SOM_DE_GATILHO, somDoEvento, type NomeSom,
} from '../../src/audio/regras';
import { SONS_DE_EVENTO } from '../../src/sim/catalogo';
import { solidoDe } from '../../src/sim/doors';
import { JOGADOR } from '../../src/sim/balance';
import type { SimEvent } from '../../src/sim/eventos';
import type { ArmaId } from '../../src/sim/fase';
import { centro } from '../../src/sim/grid';
import { criarWorld, type World } from '../../src/sim/world';
import { faseComChefe, faseMinima, porInimigo } from '../sim/ajuda';

const PLANTA = [
  '##########',
  '#P..D....#',
  '#........#',
  '##########',
].join('\n');

function mundo(): World {
  return criarWorld(faseMinima(PLANTA, { portas: [{ id: 'd1', em: 'D' }] }));
}

const som = (e: SimEvent, w = mundo()) => somDoEvento(e, w)?.som ?? null;

describe('somDoEvento: mapa de eventos para sons', () => {
  it('tiro escolhe o som pela arma e não é posicional', () => {
    const w = mundo();
    const casos: ['tiro', ArmaId, NomeSom][] = [
      ['tiro', 'pistola', 'tiroPistola'],
      ['tiro', 'escopeta', 'tiroEscopeta'],
      ['tiro', 'smg', 'tiroSmg'],
      ['tiro', 'lancador', 'disparoLancador'],
    ];
    for (const [, arma, esperado] of casos) {
      const p = somDoEvento({ tipo: 'tiro', arma, pos: { x: 3, z: 3 } }, w);
      expect(p).toEqual({ som: esperado, pos: null });
    }
  });

  it('impacto: parede ou carne, posicional na altura do evento', () => {
    const w = mundo();
    expect(somDoEvento({ tipo: 'impacto', pos: { x: 5, z: 3 }, y: 1.2, em: 'parede' }, w))
      .toEqual({ som: 'impactoParede', pos: { x: 5, z: 3 }, y: 1.2 });
    expect(somDoEvento({ tipo: 'impacto', pos: { x: 5, z: 3 }, y: 1.0, em: 'inimigo' }, w))
      .toEqual({ som: 'impactoCarne', pos: { x: 5, z: 3 }, y: 1.0 });
  });

  it('explosão é posicional', () => {
    const p = somDoEvento({ tipo: 'explosao', pos: { x: 7, z: 3 } }, mundo());
    expect(p?.som).toBe('explosao');
    expect(p?.pos).toEqual({ x: 7, z: 3 });
  });

  it('passo, pulo e pouso não são posicionais', () => {
    expect(somDoEvento({ tipo: 'passo', pos: { x: 3, z: 3 } }, mundo())).toEqual({ som: 'passo', pos: null });
    expect(somDoEvento({ tipo: 'pulo' }, mundo())).toEqual({ som: 'pulo', pos: null });
    expect(somDoEvento({ tipo: 'pouso' }, mundo())).toEqual({ som: 'pouso', pos: null });
  });

  it('porta fica no centro da célula da porta; motor ao abrir/fechar, baque nos demais estados', () => {
    const w = mundo();
    const c = centro(w.portas[0].coord);
    expect(w.portas[0].coord).toEqual([4, 1]);
    const abrindo = somDoEvento({ tipo: 'porta', id: 'd1', estado: 'abrindo' }, w);
    expect(abrindo?.som).toBe('portaMotor');
    expect(abrindo?.pos).toEqual(c);
    expect(abrindo?.y).toBeGreaterThan(0);
    expect(som({ tipo: 'porta', id: 'd1', estado: 'fechando' }, w)).toBe('portaMotor');
    expect(som({ tipo: 'porta', id: 'd1', estado: 'aberta' }, w)).toBe('portaBaque');
    expect(som({ tipo: 'porta', id: 'd1', estado: 'fechada' }, w)).toBe('portaBaque');
    expect(som({ tipo: 'porta', id: 'd1', estado: 'trancada' }, w)).toBe('portaBaque');
  });

  it('porta com id desconhecido não toca nada', () => {
    expect(somDoEvento({ tipo: 'porta', id: 'nada', estado: 'abrindo' }, mundo())).toBeNull();
  });

  it('eventos de interface e do jogador', () => {
    expect(som({ tipo: 'porta_negada', id: 'd1', exige: 2 })).toBe('portaNegada');
    expect(som({ tipo: 'pickup', indice: 0 })).toBe('pickup');
    expect(som({ tipo: 'arma_trocada', arma: 'smg' })).toBe('armaTrocada');
    expect(som({ tipo: 'sem_municao' })).toBe('semMunicao');
    expect(som({ tipo: 'dano_jogador', quantia: 10, de: { x: 1, z: 1 } })).toBe('dorJogador');
    expect(som({ tipo: 'terminal', id: 't' })).toBe('bip');
    expect(som({ tipo: 'documento', id: 'd' })).toBe('bip');
    expect(som({ tipo: 'checkpoint' })).toBe('checkpoint');
    expect(som({ tipo: 'segredo', id: 's' })).toBe('segredo');
    expect(som({ tipo: 'mensagem', texto: 'oi' })).toBe('bipDiscreto');
    expect(som({ tipo: 'jogador_morto' })).toBe('morteJogador');
    expect(som({ tipo: 'fase_concluida' })).toBe('faseConcluida');
    for (const e of [
      { tipo: 'porta_negada', id: 'd1', exige: null }, { tipo: 'pickup', indice: 0 }, { tipo: 'sem_municao' },
      { tipo: 'checkpoint' }, { tipo: 'jogador_morto' },
    ] as SimEvent[]) {
      expect(somDoEvento(e, mundo())?.pos).toBeNull();
    }
  });

  it('eventos de inimigo são posicionais no inimigo', () => {
    const w = mundo();
    const i = porInimigo(w, 'funcionario', [6, 2]);
    const casos: [SimEvent, NomeSom][] = [
      [{ tipo: 'inimigo_alerta', id: i.id }, 'grunhidoAlerta'],
      [{ tipo: 'inimigo_ataque', id: i.id }, 'grunhidoAtaque'],
      [{ tipo: 'inimigo_dor', id: i.id }, 'dorInimigo'],
      [{ tipo: 'inimigo_morto', id: i.id }, 'morteInimigo'],
    ];
    for (const [e, esperado] of casos) {
      const p = somDoEvento(e, w);
      expect(p?.som).toBe(esperado);
      expect(p?.pos).toEqual(i.pos);
      expect(p?.y).toBeGreaterThan(i.y);
    }
    expect(somDoEvento({ tipo: 'inimigo_alerta', id: 9999 }, w)).toBeNull();
  });

  it('projétil de inimigo sopra na origem; o do jogador já soa no tiro', () => {
    const w = mundo();
    w.projeteis.push({ id: 50, de: 'inimigo', tipo: 'x', pos: { x: 9, z: 3 }, y: 1.3, vel: { x: 0, z: 0 }, vy: 0, dano: 1, vida: 1 });
    w.projeteis.push({ id: 51, de: 'jogador', tipo: 'lancador', pos: { x: 3, z: 3 }, y: 1.3, vel: { x: 0, z: 0 }, vy: 0, dano: 1, vida: 1 });
    expect(somDoEvento({ tipo: 'projetil', id: 50 }, w)).toEqual({ som: 'projetil', pos: { x: 9, z: 3 }, y: 1.3 });
    expect(somDoEvento({ tipo: 'projetil', id: 51 }, w)).toBeNull();
    expect(somDoEvento({ tipo: 'projetil', id: 77 }, w)).toBeNull();
  });

  it('evento som: ids do catálogo tocam a síntese própria; desconhecido é ignorado', () => {
    expect(somDoEvento({ tipo: 'som', id: 'bip' }, mundo())).toEqual({ som: 'bip', pos: null });
    expect(somDoEvento({ tipo: 'som', id: 'sirene_curta' }, mundo())).toEqual({ som: 'sireneCurta', pos: null });
    expect(somDoEvento({ tipo: 'som', id: 'estalo' }, mundo())).toEqual({ som: 'estalo', pos: null });
    for (const id of SONS_DE_EVENTO) expect(SOM_DE_GATILHO[id]).toBeDefined();
    expect(somDoEvento({ tipo: 'som', id: 'toString' }, mundo())).toBeNull();
    expect(somDoEvento({ tipo: 'som', id: 'trombeta' }, mundo())).toBeNull();
    expect(somDoEvento({ tipo: 'som', id: '' }, mundo())).toBeNull();
  });

  it('eventos sem som e o alarme (laço controlado pelo estado do mundo) não viram som avulso', () => {
    for (const e of [
      { tipo: 'ruido', pos: { x: 1, z: 1 }, raio: 3 }, { tipo: 'gatilho', id: 'g' },
      { tipo: 'luz', grupo: 'a', ligada: true }, { tipo: 'alarme', ligado: true }, { tipo: 'alarme', ligado: false },
    ] as SimEvent[]) {
      expect(somDoEvento(e, mundo())).toBeNull();
    }
  });
});

describe('LimitadorSons', () => {
  it('no máximo 3 do mesmo tipo por quadro; tipos diferentes não se afetam', () => {
    const l = new LimitadorSons();
    l.novoQuadro(1000);
    const passaram = Array.from({ length: 8 }, () => l.permitir('impactoParede')).filter(Boolean).length;
    expect(passaram).toBe(3);
    expect(l.permitir('tiroEscopeta')).toBe(true);
  });

  it('o mesmo tipo não volta a tocar antes de 30 ms', () => {
    const l = new LimitadorSons();
    l.novoQuadro(1000);
    expect(l.permitir('passo')).toBe(true);
    l.novoQuadro(1016);
    expect(l.permitir('passo')).toBe(false);
    l.novoQuadro(1029);
    expect(l.permitir('passo')).toBe(false);
    l.novoQuadro(1031);
    expect(l.permitir('passo')).toBe(true);
    expect(l.permitir('passo')).toBe(true);
    expect(l.permitir('passo')).toBe(true);
    expect(l.permitir('passo')).toBe(false);
  });

  it('um quadro bloqueado não renova a espera', () => {
    const l = new LimitadorSons();
    l.novoQuadro(0);
    l.permitir('pickup');
    l.novoQuadro(20);
    expect(l.permitir('pickup')).toBe(false);
    l.novoQuadro(35);
    expect(l.permitir('pickup')).toBe(true);
  });
});

describe('RegistroVozes', () => {
  it('a 25ª voz corta a mais antiga', () => {
    const r = new RegistroVozes<string>(24);
    for (let k = 0; k < 24; k++) expect(r.adicionar(`v${k}`)).toBeNull();
    expect(r.tamanho).toBe(24);
    expect(r.adicionar('v24')).toBe('v0');
    expect(r.tamanho).toBe(24);
    expect(r.adicionar('v25')).toBe('v1');
  });

  it('remover libera a vaga e é idempotente', () => {
    const r = new RegistroVozes<string>(2);
    r.adicionar('a');
    r.adicionar('b');
    expect(r.remover('a')).toBe(true);
    expect(r.remover('a')).toBe(false);
    expect(r.tamanho).toBe(1);
    expect(r.adicionar('c')).toBeNull();
    expect(r.adicionar('d')).toBe('b');
    expect(r.todas()).toEqual(['c', 'd']);
  });
});

describe('distância e oclusão', () => {
  const ouvinte = (w: World) => ({ pos: w.jogador.pos, y: w.jogador.y + JOGADOR.olhos, yaw: 0 });

  it('perto e à vista: audível sem oclusão', () => {
    const w = mundo();
    const pos = { x: w.jogador.pos.x + 4, z: w.jogador.pos.z + 2 };
    expect(audivel(ouvinte(w), pos, 1.5)).toBe(true);
    expect(ocluido(w.grid, ouvinte(w), pos, solidoDe(w))).toBe(false);
  });

  it('a mais de 40 m não é criado', () => {
    const w = mundo();
    expect(audivel(ouvinte(w), { x: w.jogador.pos.x + 41, z: w.jogador.pos.z }, 1.5)).toBe(false);
  });

  it('atrás de parede fica abafado', () => {
    const w = mundo();
    // linha 3 é parede: a fonte do outro lado (fora da grade) não é visível
    expect(ocluido(w.grid, ouvinte(w), { x: w.jogador.pos.x, z: w.jogador.pos.z + 8 })).toBe(true);
  });

  it('atrás de porta fechada fica abafado; com a porta aberta, não', () => {
    const w = mundo();
    const atras = centro([6, 1]); // mesma linha do jogador, depois da porta em [4, 1]
    expect(ocluido(w.grid, ouvinte(w), atras, solidoDe(w))).toBe(true);
    w.portas[0].estado = 'aberta';
    w.portas[0].abertura = 1;
    expect(ocluido(w.grid, ouvinte(w), atras, solidoDe(w))).toBe(false);
  });

  it('o som da própria porta fechada não é abafado por ela', () => {
    const w = mundo();
    const p = somDoEvento({ tipo: 'porta', id: 'd1', estado: 'trancada' }, w);
    expect(p?.celulaPorta).toEqual([4, 1]);
    expect(ocluido(w.grid, ouvinte(w), p!.pos!, solidoDe(w), p!.celulaPorta)).toBe(false);
    // sem a exceção, a célula da porta fechada bloquearia
    expect(ocluido(w.grid, ouvinte(w), p!.pos!, solidoDe(w))).toBe(true);
  });

  it('a exceção vale só para a porta de origem: a porta B atrás da porta fechada A sai abafada', () => {
    const w = criarWorld(faseMinima(['##########', '#P.A.B...#', '##########'].join('\n'), {
      portas: [{ id: 'A', em: 'A' }, { id: 'B', em: 'B' }],
    }));
    const o = ouvinte(w);
    const a = somDoEvento({ tipo: 'porta', id: 'A', estado: 'abrindo' }, w)!;
    const b = somDoEvento({ tipo: 'porta', id: 'B', estado: 'abrindo' }, w)!;
    expect(ocluido(w.grid, o, a.pos!, solidoDe(w), a.celulaPorta)).toBe(false);
    expect(ocluido(w.grid, o, b.pos!, solidoDe(w), b.celulaPorta)).toBe(true);
  });
});

describe('somDoEvento: chefe e comportas', () => {
  const PLANTA_CHEFE = [
    '############',
    '#P.D.......#',
    '#..........#',
    '############',
  ].join('\n');
  function comChefe(): World {
    return criarWorld(faseComChefe(PLANTA_CHEFE, {
      em: [9, 2],
      perigos: [{ id: 'c1', tipo: 'comporta', area: [5, 1, 1, 2], duracao: 3, recarga: 8, danoChefe: 0.3, danoComum: 40 }],
    }, { portas: [{ id: 'd1', em: 'D' }] }));
  }
  const idChefe = (w: World) => w.chefe?.inimigoId ?? -1;

  it('desperta e investida: posicionais no chefe, acima da cabeça dos comuns', () => {
    const w = comChefe();
    const c = centro([9, 2]);
    for (const [tipo, nome] of [['chefe_desperta', 'chefeDesperta'], ['chefe_investida', 'chefeInvestida']] as const) {
      const p = somDoEvento({ tipo }, w);
      expect(p?.som).toBe(nome);
      expect(p?.pos).toEqual(c);
      expect(p?.y).toBeGreaterThan(2);
    }
  });

  it('passo do chefe: pesado e posicional, no chão sob ele', () => {
    const w = comChefe();
    const pos = { x: 12.3, z: 4.1 };
    const p = somDoEvento({ tipo: 'chefe_passo', pos }, w);
    expect(p).toMatchObject({ som: 'chefePasso', pos });
    expect(p?.y).toBeLessThan(0.5);
    expect(p?.pos).not.toBe(pos);   // cópia: o evento não é guardado
  });

  it('arrombar soa na porta (a própria porta não abafa)', () => {
    const w = comChefe();
    const p = somDoEvento({ tipo: 'chefe_arromba', porta: 'd1' }, w);
    expect(p).toMatchObject({ som: 'chefeArromba', pos: centro([3, 1]), celulaPorta: [3, 1] });
    expect(somDoEvento({ tipo: 'chefe_arromba', porta: 'nao_existe' }, w)).toBeNull();
  });

  it('morte do chefe: lamento que cai, não posicional', () => {
    expect(somDoEvento({ tipo: 'chefe_morto' }, comChefe())).toEqual({ som: 'chefeMorto', pos: null });
  });

  it('comporta: fecha e abre posicionais no centro da área; recarregando é um bip de recusa do jogador', () => {
    const w = comChefe();
    const meio = { x: 5 * 2 + 1, z: 1 * 2 + 2 };
    expect(somDoEvento({ tipo: 'perigo', id: 'c1', estado: 'fecha' }, w)).toMatchObject({ som: 'comportaFecha', pos: meio });
    expect(somDoEvento({ tipo: 'perigo', id: 'c1', estado: 'abre' }, w)).toMatchObject({ som: 'comportaAbre', pos: meio });
    expect(somDoEvento({ tipo: 'perigo', id: 'c1', estado: 'recarregando' }, w)).toEqual({ som: 'comportaRecusa', pos: null });
    expect(somDoEvento({ tipo: 'perigo', id: 'x', estado: 'fecha' }, w)).toBeNull();
  });

  it('eventos genéricos de inimigo do chefe: dor, morte e alerta calados; o golpe tem som próprio', () => {
    const w = comChefe();
    const id = idChefe(w);
    expect(somDoEvento({ tipo: 'inimigo_dor', id }, w)).toBeNull();
    expect(somDoEvento({ tipo: 'inimigo_morto', id }, w)).toBeNull();
    expect(somDoEvento({ tipo: 'inimigo_alerta', id }, w)).toBeNull();
    expect(somDoEvento({ tipo: 'inimigo_ataque', id }, w)).toMatchObject({ som: 'chefeGolpe', pos: centro([9, 2]) });
  });

  it('os inimigos comuns seguem com os sons de sempre numa fase com chefe', () => {
    const w = comChefe();
    const i = porInimigo(w, 'funcionario', [2, 2]);
    expect(somDoEvento({ tipo: 'inimigo_dor', id: i.id }, w)?.som).toBe('dorInimigo');
    expect(somDoEvento({ tipo: 'inimigo_ataque', id: i.id }, w)?.som).toBe('grunhidoAtaque');
  });
});

describe('lamentoDoChefe', () => {
  const PLANTA_L = ['#######', '#P....#', '#######'].join('\n');
  it('toca na posição do chefe só enquanto ele está inerte', () => {
    const w = criarWorld(faseComChefe(PLANTA_L, { em: [5, 1] }));
    expect(lamentoDoChefe(w)?.pos).toEqual(centro([5, 1]));
    if (w.chefe) w.chefe.fase = 'despertando';
    expect(lamentoDoChefe(w)).toBeNull();
    if (w.chefe) w.chefe.fase = 'morto';
    expect(lamentoDoChefe(w)).toBeNull();
  });

  it('sem chefe, nada', () => {
    expect(lamentoDoChefe(mundo())).toBeNull();
  });
});
