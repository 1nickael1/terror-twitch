import { describe, expect, it } from 'vitest';
import { ESTANDE } from '../../src/levels/estande';
import { validarFase } from '../../src/levels/validar';
import { criarWorld, INPUT_VAZIO } from '../../src/sim/world';
import { coletar } from '../../src/sim/pickups';
import { avancarInimigos } from '../../src/sim/ai/comum';
import { ferirInimigo } from '../../src/sim/weapons';
import { centro } from '../../src/sim/grid';
import { step, PASSO } from '../../src/sim/step';
import { transicao } from '../../src/sim/tela';
import { lacosDaFase, somDoEvento } from '../../src/audio/regras';
import { usar, avancarPortas, solidoDe } from '../../src/sim/doors';
import { avancarGatilhos } from '../../src/sim/triggers';

describe('estande de tiro', () => {
  it('oferece portas de níveis 2 e 3 que recusam cartões inferiores e liberam com o cartão correto', () => {
    for (const nivel of [2, 3] as const) {
      const w = criarWorld(ESTANDE), p = w.portas.find(p => p.exige === nivel)!;
      w.jogador.pos = centro([p.coord[0], p.coord[1] - 1]); w.jogador.yaw = Math.PI;
      w.jogador.cartoes = [nivel === 2 ? 1 : 2];
      expect(usar(w)).toContainEqual({ tipo: 'porta_negada', id: p.id, exige: nivel });
      w.jogador.cartoes = [nivel];
      expect(usar(w)).toContainEqual({ tipo: 'porta_desbloqueada', id: p.id });
      avancarPortas(w, 2); expect(p.estado).toBe('aberta');
      usar(w); avancarPortas(w, 2); expect(p.estado).toBe('fechada');
      expect(criarWorld(ESTANDE).portas.find(q => q.id === p.id)?.estado).toBe('trancada');
    }
  });
  it('mantém os inimigos da fase 1 em fila mesmo sob ruído e dano, com os sons do médico', () => {
    const w = criarWorld(ESTANDE), fila = w.inimigos.filter(i => i.grupo === 'exposicao-fase1');
    expect(fila.map(i => i.tipo)).toEqual(['funcionario', 'seguranca', 'entidade096']);
    expect(new Set(fila.map(i => i.pos.z)).size).toBe(1);
    const antes = fila.map(i => ({ ...i.pos }));
    expect(somDoEvento({ tipo: 'inimigo_ataque', id: fila[0].id }, w)?.som).toBe('doutorAtaque');
    ferirInimigo(w, fila[0], 1);
    for (let i = 0; i < 300; i++) avancarInimigos(w, [{ pos: w.jogador.pos, raio: 100 }], PASSO);
    expect(fila.map(i => i.pos)).toEqual(antes);
    expect(w.jogador.vida).toBe(60);
    const morreu = ferirInimigo(w, fila[0], 1000);
    expect(morreu.map(e => somDoEvento(e, w)?.som)).toContain('doutorMorte');
  });

  it('permite repetir a sirene com o grito distante no terminal de teste', () => {
    const w = criarWorld(ESTANDE);
    for (let n = 0; n < 2; n++) {
      const ev = avancarGatilhos(w, [{ tipo: 'terminal', id: 'sirene-teste' }]);
      expect(ev.map(e => somDoEvento(e, w)?.som)).toContain('chefeDistante');
      expect(lacosDaFase(w).alarme).toBe(false);
      avancarGatilhos(w, []); // soltar E antes de acionar novamente
    }
    expect(somDoEvento({ tipo: 'alarme', ligado: false }, w)).toBeNull();
    expect(somDoEvento({ tipo: 'explosao', pos: { x: 3, z: 3 } }, w)?.som).toBe('explosao');
  });
  it('testa acesso negado, cartão, desbloqueio e abertura e fechamento sem repetir o desbloqueio', () => {
    const w = criarWorld(ESTANDE);
    const posicionar = () => { w.jogador.pos = centro([13, 19]); w.jogador.yaw = Math.PI; };
    posicionar();
    expect(usar(w).map((e) => somDoEvento(e, w)?.som)).toEqual(['portaNegada']);
    expect(solidoDe(w)(13, 20)).toBe(true);
    const cartao = w.pickups.find((p) => p.def.tipo === 'cartao' && p.def.nivel === 1)!;
    w.jogador.pos = { ...cartao.pos };
    expect(coletar(w).map((e) => somDoEvento(e, w)?.som)).toContain('pegarCartao');
    posicionar();
    const abrir = usar(w).map((e) => somDoEvento(e, w));
    expect(abrir.map((e) => e?.som)).toEqual(['portaDesbloqueada', 'portaMotor']);
    expect(abrir.every((e) => e?.celulaPorta?.[0] === 13 && e.celulaPorta[1] === 20)).toBe(true);
    expect(avancarPortas(w, 2).map((e) => somDoEvento(e, w))).not.toContainEqual(expect.objectContaining({ som: 'portaMotor' }));
    expect(solidoDe(w)(13, 20)).toBe(false);
    expect(usar(w).map((e) => somDoEvento(e, w)?.som)).toEqual(['portaMotor']);
    avancarPortas(w, 2);
    expect(usar(w).map((e) => somDoEvento(e, w)?.som)).toEqual(['portaMotor']);
    expect(criarWorld(ESTANDE).portas[0].estado).toBe('trancada');
  });
  it('tem todos os itens e alvos alcançáveis, sem bloquear a campanha', () => {
    expect(validarFase(ESTANDE, { minSegredos: 0, minCartoes: 0 })).toEqual([]);
    const w = criarWorld(ESTANDE);
    expect(w.jogador.armas).toEqual(['pistola', 'escopeta', 'smg', 'lancador']);
    expect(w.inimigos).toHaveLength(11);
    expect(lacosDaFase(w)).toEqual({ ambiente: false, drone: false, alarme: false, lamento: false });
  });

  it('permite coletar todas as categorias e repor tudo em um mundo novo', () => {
    const w = criarWorld(ESTANDE);
    for (const p of w.pickups) {
      w.jogador.pos = { ...p.pos };
      const eventos = coletar(w);
      expect(eventos.some((e) => e.tipo === 'pickup')).toBe(true);
      if (p.def.tipo.startsWith('vida_')) expect(eventos.map((e) => somDoEvento(e, w)?.som)).toContain('recuperarVida');
      if (p.def.tipo.startsWith('colete_')) expect(eventos.map((e) => somDoEvento(e, w)?.som)).toContain('pegarColete');
      if (p.def.tipo === 'cartao') expect(eventos.map((e) => somDoEvento(e, w)?.som)).toContain('pegarCartao');
      expect(p.pego).toBe(true);
    }
    expect(w.jogador.cartoes).toEqual([1, 2, 3]);
    expect(w.jogador.vida).toBe(100);
    expect(w.jogador.colete).toBeGreaterThan(0);
    const novo = criarWorld(ESTANDE);
    expect(novo.pickups.every((p) => !p.pego)).toBe(true);
    expect(novo.jogador.vida).toBe(60);
    expect(novo.jogador.municao).toEqual(ESTANDE.arsenal.municao);
  });

  it('mantém os alvos parados mesmo após tiros e aceita destruí-los', () => {
    const w = criarWorld(ESTANDE);
    const alvo = w.inimigos[0];
    const pos = { ...alvo.pos };
    ferirInimigo(w, alvo, 20);
    for (let n = 0; n < 180; n++) avancarInimigos(w, [{ pos: w.jogador.pos, raio: 100 }], PASSO);
    expect(alvo.pos).toEqual(pos);
    expect(w.jogador.vida).toBe(60);
    ferirInimigo(w, alvo, 1000);
    expect(alvo.modo).toBe('morto');
  });

  it('não conclui campanha ao pisar na saída técnica', () => {
    const w = criarWorld(ESTANDE);
    w.jogador.pos = centro(ESTANDE.saida);
    expect(step(w, INPUT_VAZIO, PASSO).some((e) => e.tipo === 'fase_concluida')).toBe(false);
    expect(w.estado).toBe('jogando');
    const jogando = transicao({ tela: 'titulo', fase: 0 }, { c: 'estande' }, 2, 1);
    expect(jogando).toEqual({ tela: 'jogando', fase: -1 });
    expect(transicao(jogando, { c: 'concluiu' }, 2, 1)).toBe(jogando);
    const pausa = transicao(jogando, { c: 'pausar' }, 2, 1);
    expect(transicao(pausa, { c: 'reiniciar_estande' }, 2, 1)).toEqual(jogando);
    const campanha = { tela: 'pausa', fase: 0 } as const;
    expect(transicao(campanha, { c: 'reiniciar_estande' }, 2, 1)).toBe(campanha);
  });
});
