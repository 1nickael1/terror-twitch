import { describe, expect, it } from 'vitest';
import { formatarTempo, ladoDoDano, nomeDoPickup, textoDoEvento } from '../../src/components/formato';
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
