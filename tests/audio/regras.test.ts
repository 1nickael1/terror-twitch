// tests/audio/regras.test.ts
import { describe, expect, it } from 'vitest';
import {
  audivel, contarLacos, HISTERESE_LACO, lacosDaFase, lacosDePerigo, lamentoDoChefe, LIMITE, LimitadorSons, MAX_LACOS_PERIGO,
  ocluido, POSICIONAL,
  RegistroVozes, SOM_DE_GATILHO, somDoEvento, vagasAvulsas, type NomeSom,
} from '../../src/audio/regras';
import { SONS_DE_EVENTO } from '../../src/sim/catalogo';
import { solidoDe } from '../../src/sim/doors';
import { JOGADOR } from '../../src/sim/balance';
import type { SimEvent } from '../../src/sim/eventos';
import type { ArmaId } from '../../src/sim/fase';
import { centro } from '../../src/sim/grid';
import { criarWorld, type World } from '../../src/sim/world';
import { faseComChefe, faseComChefe049, faseMinima, porInimigo } from '../sim/ajuda';

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
      [{ tipo: 'inimigo_alerta', id: i.id }, 'doutorAlerta'],
      [{ tipo: 'inimigo_ataque', id: i.id }, 'doutorAtaque'],
      [{ tipo: 'inimigo_dor', id: i.id }, 'doutorDor'],
      [{ tipo: 'inimigo_morto', id: i.id }, 'doutorMorte'],
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
    const i = porInimigo(w, 'seguranca', [2, 2]);
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

describe('lacosDaFase (quais laços da fase tocam dado o estado)', () => {
  const PLANTA_L = ['#######', '#P....#', '#######'].join('\n');

  it('em jogo: ambiente e drone sempre; alarme segue world.alarme; lamento com o chefe inerte', () => {
    const w = criarWorld(faseComChefe(PLANTA_L, { em: [5, 1] }));
    expect(lacosDaFase(w)).toEqual({ ambiente: true, drone: true, alarme: false, lamento: true });
    w.alarme = true;
    w.sirene = 5;
    if (w.chefe) w.chefe.fase = 'despertando';
    expect(lacosDaFase(w)).toEqual({ ambiente: true, drone: true, alarme: true, lamento: false });
  });

  it('morto (tela de morte, 2 s): os laços seguem', () => {
    const w = mundo();
    w.alarme = true;
    w.sirene = 5;
    w.estado = 'morto';
    expect(lacosDaFase(w)).toEqual({ ambiente: true, drone: true, alarme: true, lamento: false });
  });

  it('fase concluída: nenhum laço, nem com o alarme ligado ou o chefe inerte', () => {
    const w = criarWorld(faseComChefe(PLANTA_L, { em: [5, 1] }));
    w.alarme = true;
    w.estado = 'concluida';
    expect(lacosDaFase(w)).toEqual({ ambiente: false, drone: false, alarme: false, lamento: false });
  });
});

describe('fase 2: sons dos reanimados, do frasco e do cenário', () => {
  it('gaveta e elevador têm síntese própria (não reaproveitam estalo e bip)', () => {
    expect(somDoEvento({ tipo: 'som', id: 'gaveta' }, mundo())).toEqual({ som: 'gaveta', pos: null });
    expect(somDoEvento({ tipo: 'som', id: 'elevador' }, mundo())).toEqual({ som: 'elevador', pos: null });
    const usados = Object.values(SOM_DE_GATILHO);
    expect(new Set(usados).size).toBe(usados.length);
  });

  it('reanimados gemem ao notar o jogador; os outros tipos seguem grunhindo', () => {
    const w = mundo();
    const r = porInimigo(w, 'reanimado', [6, 2]);
    const c = porInimigo(w, 'reanimado_cirurgico', [7, 2]);
    const e = porInimigo(w, 'enfermeiro', [8, 2]);
    expect(somDoEvento({ tipo: 'inimigo_alerta', id: r.id }, w)?.som).toBe('gemido');
    expect(somDoEvento({ tipo: 'inimigo_alerta', id: c.id }, w)?.som).toBe('gemido');
    expect(somDoEvento({ tipo: 'inimigo_alerta', id: e.id }, w)?.som).toBe('grunhidoAlerta');
    // dor e morte dos reanimados: as de sempre
    expect(somDoEvento({ tipo: 'inimigo_dor', id: r.id }, w)?.som).toBe('dorInimigo');
  });

  it('levantar: posicional no corpo, rente ao chão', () => {
    const w = mundo();
    const r = porInimigo(w, 'reanimado', [6, 2], { corpo: true });
    const p = somDoEvento({ tipo: 'inimigo_levanta', id: r.id }, w);
    expect(p).toMatchObject({ som: 'levantar', pos: r.pos });
    expect((p?.y ?? 99) - r.y).toBeLessThan(0.6);
    expect(somDoEvento({ tipo: 'inimigo_levanta', id: 999 }, w)).toBeNull();
  });

  it('frasco: o arremesso troca o sopro do projétil; a quebra soa onde o vidro bateu', () => {
    const w = mundo();
    w.projeteis.push({ id: 60, de: 'inimigo', tipo: 'enfermeiro', pos: { x: 9, z: 3 }, y: 1.5, vel: { x: 0, z: 0 }, vy: 0, dano: 1, vida: 1 });
    w.projeteis.push({ id: 61, de: 'inimigo', tipo: 'seguranca', pos: { x: 9, z: 3 }, y: 1.5, vel: { x: 0, z: 0 }, vy: 0, dano: 1, vida: 1 });
    expect(somDoEvento({ tipo: 'projetil', id: 60 }, w)).toEqual({ som: 'frascoArremesso', pos: { x: 9, z: 3 }, y: 1.5 });
    expect(somDoEvento({ tipo: 'projetil', id: 61 }, w)?.som).toBe('projetil');
    expect(somDoEvento({ tipo: 'frasco_quebra', pos: { x: 4, z: 3 }, y: 0.1 }, w)).toEqual({ som: 'vidroQuebra', pos: { x: 4, z: 3 }, y: 0.1 });
  });
});

describe('fase 2: chefe 049', () => {
  const PLANTA_049 = ['############', '#P.........#', '#..........#', '############'].join('\n');
  const w049 = () => criarWorld(faseComChefe049(PLANTA_049, { em: [9, 2] }));

  it('voz, passo e morte próprios (não os do 096), posicionais nele', () => {
    const w = w049();
    expect(somDoEvento({ tipo: 'chefe_desperta' }, w)).toMatchObject({ som: 'chefe049Desperta', pos: centro([9, 2]) });
    expect(somDoEvento({ tipo: 'chefe_passo', pos: { x: 5, z: 3 } }, w)?.som).toBe('chefe049Passo');
    expect(somDoEvento({ tipo: 'chefe_morto' }, w)).toEqual({ som: 'chefe049Morto', pos: null });
  });

  it('toque (aviso grave), reanimar e pressa: na cabeça do chefe', () => {
    const w = w049();
    const casos: [SimEvent, NomeSom][] = [
      [{ tipo: 'chefe_toque' }, 'chefeToque'], [{ tipo: 'chefe_reanima', corpo: 3 }, 'chefeReanima'], [{ tipo: 'chefe_apressa' }, 'chefeApressa'],
    ];
    for (const [e, nome] of casos) {
      const p = somDoEvento(e, w);
      expect(p?.som).toBe(nome);
      expect(p?.pos).toEqual(centro([9, 2]));
      expect(p?.y).toBeGreaterThan(1.5);
    }
  });

  it('o 096 continua com os sons dele', () => {
    const w = criarWorld(faseComChefe(PLANTA_049, { em: [9, 2] }));
    expect(somDoEvento({ tipo: 'chefe_desperta' }, w)?.som).toBe('chefeDesperta');
    expect(somDoEvento({ tipo: 'chefe_passo', pos: { x: 5, z: 3 } }, w)?.som).toBe('chefePasso');
    expect(somDoEvento({ tipo: 'chefe_morto' }, w)?.som).toBe('chefeMorto');
  });

  it('o 049 inerte não tem o lamento do 096', () => {
    const w = w049();
    expect(lamentoDoChefe(w)).toBeNull();
    expect(lacosDaFase(w).lamento).toBe(false);
  });
});

describe('fase 2: perigos de área', () => {
  const PLANTA_P = ['############', '#P.........#', '#..........#', '############'].join('\n');
  const areaDef = (id: string, tipo: 'ultravioleta' | 'vapor', col: number) => ({
    id, tipo, area: [col, 1, 1, 2] as const, aviso: 1, duracao: 4, recarga: 10, danoChefePorSeg: 0.07, danoPorSeg: 10,
  });
  function comPerigos(): World {
    return criarWorld(faseComChefe(PLANTA_P, {
      em: [10, 2],
      perigos: [
        { id: 'c1', tipo: 'comporta', area: [3, 1, 1, 2], duracao: 3, recarga: 8, danoChefe: 0.3, danoComum: 40 },
        areaDef('uv1', 'ultravioleta', 5), areaDef('v1', 'vapor', 7), areaDef('uv2', 'ultravioleta', 9),
      ],
    }));
  }
  const ouvinte = (w: World) => ({ pos: w.jogador.pos, y: w.jogador.y + JOGADOR.olhos, yaw: 0 });

  it('aviso e liga: posicionais no alto do centro da área; desliga não toca avulso (o laço para)', () => {
    const w = comPerigos();
    const meio = { x: 5 * 2 + 1, z: 1 * 2 + 2 };
    const aviso = somDoEvento({ tipo: 'perigo', id: 'uv1', estado: 'aviso' }, w);
    expect(aviso).toMatchObject({ som: 'uvAviso', pos: meio });
    expect(aviso?.y).toBeGreaterThan(2);
    expect(somDoEvento({ tipo: 'perigo', id: 'uv1', estado: 'liga' }, w)?.som).toBe('uvLiga');
    expect(somDoEvento({ tipo: 'perigo', id: 'v1', estado: 'aviso' }, w)?.som).toBe('vaporAviso');
    expect(somDoEvento({ tipo: 'perigo', id: 'v1', estado: 'liga' }, w)?.som).toBe('vaporLiga');
    expect(somDoEvento({ tipo: 'perigo', id: 'uv1', estado: 'desliga' }, w)).toBeNull();
    expect(somDoEvento({ tipo: 'perigo', id: 'v1', estado: 'desliga' }, w)).toBeNull();
  });

  it('recarregando: perigo de área tem recusa própria; a comporta segue com o bip dela', () => {
    const w = comPerigos();
    expect(somDoEvento({ tipo: 'perigo', id: 'uv1', estado: 'recarregando' }, w)).toEqual({ som: 'perigoRecusa', pos: null });
    expect(somDoEvento({ tipo: 'perigo', id: 'v1', estado: 'recarregando' }, w)).toEqual({ som: 'perigoRecusa', pos: null });
    expect(somDoEvento({ tipo: 'perigo', id: 'c1', estado: 'recarregando' }, w)).toEqual({ som: 'comportaRecusa', pos: null });
    expect(somDoEvento({ tipo: 'perigo', id: 'c1', estado: 'fecha' }, w)?.som).toBe('comportaFecha');
  });

  it('lacosDePerigo: só os de área ligados, os 2 mais próximos, em ordem de distância', () => {
    const w = comPerigos();
    expect(lacosDePerigo(w, ouvinte(w))).toEqual([]);
    // comporta fechada não tem laço; aviso também não
    w.perigos[0].ativo = 2;
    w.perigos[1].aviso = 0.5;
    expect(lacosDePerigo(w, ouvinte(w))).toEqual([]);
    w.perigos[1].ativo = 2;
    w.perigos[2].ativo = 2;
    w.perigos[3].ativo = 2;
    const l = lacosDePerigo(w, ouvinte(w));
    expect(l.length).toBe(MAX_LACOS_PERIGO);
    expect(l.map((x) => x.id)).toEqual(['uv1', 'v1']);
    expect(l.map((x) => x.tipo)).toEqual(['ultravioleta', 'vapor']);
  });

  it('lacosDePerigo: histerese na borda do alcance (entra a maxDistance, sai a maxDistance × HISTERESE_LACO)', () => {
    const w = comPerigos();
    w.perigos[1].ativo = 2;
    const meio = { x: 5 * 2 + 1, z: 1 * 2 + 2 };
    const y = 2.4 + 0;   // piso 0 + altura do perigo de área
    // ouvinte na mesma altura, a uma distância entre maxDistance e maxDistance × histerese
    const d = POSICIONAL.maxDistance * (1 + (HISTERESE_LACO - 1) / 2);
    const longe = { pos: { x: meio.x + d, z: meio.z }, y, yaw: 0 };
    expect(lacosDePerigo(w, longe)).toEqual([]);                          // não entra
    expect(lacosDePerigo(w, longe, new Set(['uv1'])).map((l) => l.id)).toEqual(['uv1']);   // já tocando: fica
    const alem = { pos: { x: meio.x + POSICIONAL.maxDistance * HISTERESE_LACO + 0.5, z: meio.z }, y, yaw: 0 };
    expect(lacosDePerigo(w, alem, new Set(['uv1']))).toEqual([]);         // além da margem: sai
  });

  it('lacosDePerigo: quem já toca leva vantagem no desempate (não troca por um quase igual)', () => {
    const w = comPerigos();
    w.perigos[1].ativo = 2;   // uv1 (x 11)
    w.perigos[2].ativo = 2;   // v1 (x 15)
    w.perigos[3].ativo = 2;   // uv2 (x 19)
    // ouvinte um pouco mais perto de uv1 que de uv2, em linha
    const o = { pos: { x: 14.6, z: 4 }, y: 2.4, yaw: 0 };
    expect(lacosDePerigo(w, o).map((l) => l.id)).toEqual(['v1', 'uv1']);
    // uv2 já tocando e só 0,8 m mais longe que uv1: fica com a vaga
    expect(lacosDePerigo(w, o, new Set(['v1', 'uv2'])).map((l) => l.id).sort()).toEqual(['uv2', 'v1']);
  });

  it('lacosDePerigo reaproveita o array de saída', () => {
    const w = comPerigos();
    w.perigos[1].ativo = 2;
    const saida: ReturnType<typeof lacosDePerigo> = [];
    expect(lacosDePerigo(w, ouvinte(w), undefined, saida)).toBe(saida);
    expect(saida.length).toBe(1);
    w.perigos[1].ativo = 0;
    lacosDePerigo(w, ouvinte(w), undefined, saida);
    expect(saida.length).toBe(0);
  });

  it('lacosDePerigo: nada com a fase concluída nem fora do alcance do ouvido', () => {
    const w = comPerigos();
    w.perigos[1].ativo = 2;
    expect(lacosDePerigo(w, { pos: { x: 500, z: 500 }, y: 1.6, yaw: 0 })).toEqual([]);
    w.estado = 'concluida';
    expect(lacosDePerigo(w, ouvinte(w))).toEqual([]);
  });
});

describe('limite de vozes com os laços (correção adiada 2)', () => {
  it('cada laço tocando tira uma vaga das avulsas, até o mínimo', () => {
    expect(vagasAvulsas(0)).toBe(LIMITE.vozes);
    expect(vagasAvulsas(3)).toBe(LIMITE.vozes - 3);
    expect(vagasAvulsas(100)).toBe(LIMITE.minAvulsas);
    expect(vagasAvulsas(-2)).toBe(LIMITE.vozes);
  });

  it('com todos os laços possíveis (fase + perigos), laços + avulsas não passam do limite', () => {
    const lacos = contarLacos({ ambiente: true, drone: true, alarme: true, lamento: true }, MAX_LACOS_PERIGO);
    expect(lacos).toBe(4 + MAX_LACOS_PERIGO);
    expect(lacos + vagasAvulsas(lacos)).toBeLessThanOrEqual(LIMITE.vozes);
    expect(contarLacos({ ambiente: false, drone: true, alarme: false, lamento: false }, 0)).toBe(1);
  });

  it('RegistroVozes.definirLimite corta as mais antigas que sobram; o limite novo vale para as próximas', () => {
    const r = new RegistroVozes<string>(5);
    for (const v of ['a', 'b', 'c', 'd', 'e']) r.adicionar(v);
    expect(r.definirLimite(3)).toEqual(['a', 'b']);
    expect(r.todas()).toEqual(['c', 'd', 'e']);
    expect(r.vagas).toBe(3);
    expect(r.adicionar('f')).toBe('c');
    expect(r.tamanho).toBe(3);
    // subir o limite não corta nada
    expect(r.definirLimite(6)).toEqual([]);
    expect(r.adicionar('g')).toBeNull();
    expect(r.tamanho).toBe(4);
  });
});
