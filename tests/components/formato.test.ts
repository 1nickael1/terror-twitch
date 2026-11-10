import { describe, expect, it } from 'vitest';
import { barraDoChefe, formatarTempo, ladoDoDano, nomeDoPickup, textoDoEvento } from '../../src/components/formato';
import { criarWorld, type World } from '../../src/sim/world';
import { faseComChefe, faseMinima } from '../sim/ajuda';
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
});
