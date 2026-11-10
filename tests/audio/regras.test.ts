// tests/audio/regras.test.ts
import { describe, expect, it } from 'vitest';
import {
  audivel, LimitadorSons, ocluido, RegistroVozes, somDoEvento, type NomeSom,
} from '../../src/audio/regras';
import { solidoDe } from '../../src/sim/doors';
import { JOGADOR } from '../../src/sim/balance';
import type { SimEvent } from '../../src/sim/eventos';
import type { ArmaId } from '../../src/sim/fase';
import { centro } from '../../src/sim/grid';
import { criarWorld, type World } from '../../src/sim/world';
import { faseMinima, porInimigo } from '../sim/ajuda';

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

  it('evento som: id conhecido toca o som de mesmo nome; desconhecido é ignorado', () => {
    expect(somDoEvento({ tipo: 'som', id: 'bip' }, mundo())).toEqual({ som: 'bip', pos: null });
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
