import { describe, expect, it } from 'vitest';
import { barraDoChefe, dicaDeUso, dicaDoHud, duracaoMensagem, formatarTempo, ladoDoDano, nomeDoPickup, textoDoEvento } from '../../src/components/formato';
import { criarWorld, type World } from '../../src/sim/world';
import { faseComChefe, faseComChefe049, faseMinima } from '../sim/ajuda';
import type { PickupDef } from '../../src/sim/fase';

describe('formatarTempo', () => {
  it('mm:ss com zeros à esquerda, segundos truncados', () => {
    expect(formatarTempo(0)).toBe('00:00');
    expect(formatarTempo(65.9)).toBe('01:05');
    expect(formatarTempo(3600 + 5)).toBe('60:05');
  });
  it('valor inválido vira 00:00', () => {
    expect(formatarTempo(-3)).toBe('00:00');
    expect(formatarTempo(Number.NaN)).toBe('00:00');
  });
});

describe('nomeDoPickup', () => {
  it('nomeia cada tipo', () => {
    const p = (d: Partial<PickupDef>): PickupDef => ({ em: [0, 0], tipo: 'vida_p', ...d });
    expect(nomeDoPickup(p({ tipo: 'vida_g' }))).toBe('Kit médico');
    expect(nomeDoPickup(p({ tipo: 'arma', arma: 'escopeta' }))).toBe('Escopeta de contenção');
    expect(nomeDoPickup(p({ tipo: 'cartao', nivel: 2 }))).toBe('Cartão de acesso nível 2');
    expect(nomeDoPickup(p({ tipo: 'municao', municao: 'cartuchos', quantidade: 8 }))).toBe('Cartuchos (8)');
  });
});

describe('textoDoEvento', () => {
  const pickups: PickupDef[] = [{ em: [0, 0], tipo: 'colete_p' }];
  it('mensagens que o HUD mostra', () => {
    expect(textoDoEvento({ tipo: 'mensagem', texto: 'Olá' }, pickups)).toBe('Olá');
    expect(textoDoEvento({ tipo: 'porta_negada', id: 'a', exige: 3 }, pickups)).toBe('Acesso negado: cartão nível 3');
    expect(textoDoEvento({ tipo: 'porta_negada', id: 'a', exige: null }, pickups)).toBe('Trancada');
    expect(textoDoEvento({ tipo: 'pickup', indice: 0 }, pickups)).toBe('Placa de colete');
    expect(textoDoEvento({ tipo: 'segredo', id: 's' }, pickups)).toBe('Segredo encontrado');
    expect(textoDoEvento({ tipo: 'checkpoint' }, pickups)).toBe('Checkpoint');
  });
  it('outros eventos não geram mensagem', () => {
    expect(textoDoEvento({ tipo: 'pulo' }, pickups)).toBeNull();
    expect(textoDoEvento({ tipo: 'pickup', indice: 9 }, pickups)).toBeNull();
  });
});

describe('ladoDoDano', () => {
  // yaw 0: frente = (0, -1), direita = (1, 0)
  const pos = { x: 0, z: 0 };
  it('classifica pela direção relativa ao olhar', () => {
    expect(ladoDoDano(pos, 0, { x: 0, z: -5 })).toBe('frente');
    expect(ladoDoDano(pos, 0, { x: 0, z: 5 })).toBe('tras');
    expect(ladoDoDano(pos, 0, { x: 5, z: 0 })).toBe('direita');
    expect(ladoDoDano(pos, 0, { x: -5, z: 0 })).toBe('esquerda');
  });
  it('gira junto com o jogador e sem direção vira null', () => {
    expect(ladoDoDano(pos, Math.PI / 2, { x: -5, z: 0 })).toBe('frente');
    expect(ladoDoDano(pos, 0, { x: 0, z: 0 })).toBeNull();
  });
});

describe('barraDoChefe', () => {
  const PLANTA = ['#######', '#P....#', '#######'].join('\n');
  const comChefe = () => criarWorld(faseComChefe(PLANTA, { em: [5, 1], nome: 'SCP-096' }));
  const chefeDe = (w: World) => w.inimigos.find((i) => i.id === w.chefe?.inimigoId);

  it('sem chefe: nenhuma barra', () => {
    expect(barraDoChefe(criarWorld(faseMinima(PLANTA)))).toBeNull();
  });

  it('inerte ou morto: nenhuma barra', () => {
    const w = comChefe();
    expect(barraDoChefe(w)).toBeNull();
    if (w.chefe) w.chefe.fase = 'morto';
    expect(barraDoChefe(w)).toBeNull();
  });

  it('acordado: nome da fase e vida em 0..1 arredondada a 1%', () => {
    const w = comChefe();
    for (const fase of ['despertando', 'perseguicao', 'arrombando', 'investida', 'pausa'] as const) {
      if (w.chefe) w.chefe.fase = fase;
      expect(barraDoChefe(w)).toEqual({ nome: 'SCP-096', vida: 1 });
    }
    const i = chefeDe(w);
    if (i) i.vida = 900 * 0.4567;
    expect(barraDoChefe(w)).toEqual({ nome: 'SCP-096', vida: 0.46 });
    if (i) i.vida = 1;
    expect(barraDoChefe(w)?.vida).toBe(0);
  });

  it('Inimigo do chefe já morto (a fase só vira `morto` no passo seguinte): nenhuma barra', () => {
    const w = comChefe();
    if (w.chefe) w.chefe.fase = 'perseguicao';
    const i = chefeDe(w);
    if (i) {
      i.vida = 0;
      i.modo = 'morto';
    }
    expect(barraDoChefe(w)).toBeNull();
  });

  it('chefe 049: nome da ChefeDef e vida pela vida do tipo dele; sem barra inerte ou morto', () => {
    const w = criarWorld(faseComChefe049(PLANTA, { em: [5, 1] }));
    expect(barraDoChefe(w)).toBeNull();
    for (const fase of ['despertando', 'caminhando', 'tocando', 'reanimando', 'apressado'] as const) {
      if (w.chefe?.tipo === 'entidade049') w.chefe.fase = fase;
      expect(barraDoChefe(w)).toEqual({ nome: 'SCP-049', vida: 1 });
    }
    const i = chefeDe(w);
    if (i) i.vida = 1100 * 0.25;
    expect(barraDoChefe(w)).toEqual({ nome: 'SCP-049', vida: 0.25 });
    if (w.chefe?.tipo === 'entidade049') w.chefe.fase = 'morto';
    expect(barraDoChefe(w)).toBeNull();
  });
});

describe('dicaDeUso (aviso do botão de usar no HUD)', () => {
  const porta = (estado: 'fechada' | 'aberta' | 'trancada' | 'abrindo' | 'fechando', exige: 1 | 2 | 3 | null = null, temCartao = false, vaoOcupado = false) =>
    ({ tipo: 'porta', id: 'd', estado, exige, temCartao, vaoOcupado }) as const;

  it('sem alvo, nada', () => {
    expect(dicaDeUso(null)).toBeNull();
  });

  it('portas: abrir, fechar, trancada com e sem cartão; em movimento, nada', () => {
    expect(dicaDeUso(porta('fechada'))).toBe('[E] Abrir porta');
    expect(dicaDeUso(porta('aberta'))).toBe('[E] Fechar porta');
    // atravessando a porta: o botão não fecha com alguém no vão
    expect(dicaDeUso(porta('aberta', null, false, true))).toBeNull();
    expect(dicaDeUso(porta('trancada'))).toBe('Trancada');
    expect(dicaDeUso(porta('trancada', 2))).toBe('Trancada · requer cartão nível 2');
    expect(dicaDeUso(porta('trancada', 2, true))).toBe('[E] Destrancar (cartão nível 2)');
    expect(dicaDeUso(porta('abrindo'))).toBeNull();
    expect(dicaDeUso(porta('fechando'))).toBeNull();
  });

  it('terminais: comum, comporta pronta e recarregando (segundos para cima)', () => {
    expect(dicaDeUso({ tipo: 'terminal', id: 't', rotulo: 'Painel', perigo: null })).toBe('[E] Painel');
    expect(dicaDeUso({ tipo: 'terminal', id: 't', rotulo: 'Comporta norte', perigo: { id: 'p', pronto: true, recarga: 0 } }))
      .toBe('[E] Comporta norte · pronta');
    expect(dicaDeUso({ tipo: 'terminal', id: 't', rotulo: 'Comporta sul', perigo: { id: 'p', pronto: false, recarga: 4.2 } }))
      .toBe('Comporta sul · recarregando 5 s');
    expect(dicaDeUso({ tipo: 'terminal', id: 't', rotulo: 'Comporta sul', perigo: { id: 'p', pronto: false, recarga: 0.01 } }))
      .toBe('Comporta sul · recarregando 1 s');
  });

  it('documento', () => {
    expect(dicaDeUso({ tipo: 'documento', id: 'd', titulo: 'Bilhete dobrado' })).toBe('[E] Ler: Bilhete dobrado');
  });
});

describe('dicaDoHud (só com a tela de jogo e o mundo jogando)', () => {
  const PLANTA_P = ['########', '#P.D...#', '########'].join('\n');
  const comPorta = () => {
    const w = criarWorld(faseMinima(PLANTA_P, { portas: [{ id: 'd1', em: 'D' }] }));
    w.jogador.pos = { x: 5, z: 3 };
    return w;
  };
  it('em jogo, a dica do alvo', () => {
    expect(dicaDoHud('jogando', comPorta())).toBe('[E] Abrir porta');
  });
  it('sob pausa, documento, morte ou fim: nada', () => {
    for (const tela of ['pausa', 'documento', 'morte', 'fim_de_fase', 'titulo'] as const) expect(dicaDoHud(tela, comPorta()), tela).toBeNull();
  });
  it('mundo morto ou concluído: nada', () => {
    const w = comPorta();
    w.estado = 'morto';
    expect(dicaDoHud('jogando', w)).toBeNull();
  });
});

describe('duracaoMensagem (ms na tela, proporcional ao texto)', () => {
  it('mínimo de 4 s para textos curtos', () => {
    expect(duracaoMensagem('Checkpoint')).toBe(4000);
    expect(duracaoMensagem('')).toBe(4000);
  });
  it('1,2 s + 55 ms por caractere acima do mínimo', () => {
    expect(duracaoMensagem('x'.repeat(100))).toBe(1200 + 55 * 100);
  });
  it('limitada a 10 s', () => {
    expect(duracaoMensagem('x'.repeat(400))).toBe(10000);
  });
});
