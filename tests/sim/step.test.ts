// tests/sim/step.test.ts
import { describe, expect, it } from 'vitest';
import { centro } from '../../src/sim/grid';
import { PASSO, step } from '../../src/sim/step';
import { INPUT_VAZIO, criarWorld, restaurarCheckpoint, type InputFrame } from '../../src/sim/world';
import { faseMinima, porInimigo } from './ajuda';

const FASE = faseMinima(`
  ###########
  #P..D...sX#
  ###########
`, {
  portas: [{ id: 'd1', em: 'D' }],
  segredos: [{ id: 's1', area: [8, 1, 1, 1] }],
  documentos: [{ id: 'doc1', em: [2, 1], titulo: 'Aviso', texto: 'Não olhe.' }],
  checkpoints: [[6, 1]],
  saida: [9, 1],
});
const rodar = (w: ReturnType<typeof criarWorld>, input: InputFrame, passos: number) => {
  const tipos: string[] = [];
  for (let i = 0; i < passos; i++) tipos.push(...step(w, input, PASSO).map((e) => e.tipo));
  return tipos;
};

describe('step', () => {
  it('conta o tempo', () => {
    const w = criarWorld(FASE);
    rodar(w, INPUT_VAZIO, 60);
    expect(w.stats.tempo).toBeCloseTo(1);
  });

  it('percorre a fase: lê o documento, abre a porta, acha o segredo e sai', () => {
    const w = criarWorld(FASE);
    const tipos: string[] = [];
    tipos.push(...rodar(w, { ...INPUT_VAZIO, usar: true }, 1));          // documento ao lado
    tipos.push(...rodar(w, { ...INPUT_VAZIO, frente: 1 }, 90));          // encosta na porta na nova velocidade
    tipos.push(...rodar(w, { ...INPUT_VAZIO, usar: true }, 1));
    tipos.push(...rodar(w, { ...INPUT_VAZIO, frente: 1 }, 240));
    expect(tipos).toEqual(expect.arrayContaining(['documento', 'porta', 'checkpoint', 'segredo', 'fase_concluida']));
    expect(w.estado).toBe('concluida');
    expect(w.stats.segredos).toEqual(['s1']);
    expect(w.stats.documentos).toEqual(['doc1']);
  });

  it('depois de concluída ou morto, o mundo para', () => {
    const w = criarWorld(FASE);
    w.estado = 'morto';
    const antes = { ...w.jogador.pos };
    expect(rodar(w, { ...INPUT_VAZIO, frente: 1 }, 30)).toEqual([]);
    expect(w.jogador.pos).toEqual(antes);
  });

  it('a lanterna alterna na borda', () => {
    const w = criarWorld(FASE);
    step(w, { ...INPUT_VAZIO, lanterna: true }, PASSO);
    expect(w.jogador.lanterna).toBe(false);
  });

  it('cronômetro zerado mata o jogador', () => {
    const w = criarWorld(FASE);
    w.cronometro = 0.5;
    const tipos = rodar(w, INPUT_VAZIO, 40);
    expect(tipos).toContain('jogador_morto');
  });

  it('é determinístico', () => {
    const a = criarWorld(FASE);
    const b = criarWorld(FASE);
    const input = { ...INPUT_VAZIO, frente: 1, atirar: true };
    rodar(a, input, 120);
    rodar(b, input, 120);
    expect(a.jogador.pos).toEqual(b.jogador.pos);
    expect(a.semente).toBe(b.semente);
    expect(centro([1, 1])).toBeDefined();
  });
});

describe('step: morte por inimigo', () => {
  it('não grava checkpoint nem dispara gatilho de área no mesmo passo', () => {
    const w = criarWorld(faseMinima('#######\n#P....#\n#######', {
      gatilhos: [{ id: 'g1', quando: { tipo: 'area', area: [1, 1, 1, 1] }, faz: [{ acao: 'mensagem', texto: 'oi' }] }],
      checkpoints: [[1, 1]],
      saida: [5, 1],
    }));
    const antes = w.checkpoint;
    const i = porInimigo(w, 'funcionario', [2, 1]);
    i.pos = { x: w.jogador.pos.x + 1, z: w.jogador.pos.z };
    i.modo = 'ataque';
    i.timer = 0.001;
    w.jogador.vida = 1;
    const tipos = rodar(w, INPUT_VAZIO, 1);
    expect(tipos).toContain('jogador_morto');
    expect(tipos).not.toContain('gatilho');
    expect(tipos).not.toContain('mensagem');
    expect(tipos).not.toContain('checkpoint');
    expect(w.estado).toBe('morto');
    expect(w.checkpoint).toBe(antes);
    expect(w.checkpointsUsados).toEqual([]);
    expect(w.gatilhosFeitos.size).toBe(0);
  });
});

describe('step: checkpoint de célula', () => {
  it('é usado uma vez e restaurar volta para ele', () => {
    const w = criarWorld(faseMinima('########\n#P.....#\n########', { checkpoints: [[3, 1]], saida: [6, 1] }));
    w.jogador.pos = centro([3, 1]);
    expect(rodar(w, INPUT_VAZIO, 1)).toContain('checkpoint');
    expect(rodar(w, INPUT_VAZIO, 10)).not.toContain('checkpoint');
    expect(w.checkpointsUsados).toEqual([0]);

    w.jogador.pos = centro([5, 1]);
    w.jogador.vida = 40;
    rodar(w, INPUT_VAZIO, 1);
    restaurarCheckpoint(w);
    expect(w.jogador.pos).toEqual(centro([3, 1]));
    expect(w.jogador.vida).toBe(100);
    expect(w.checkpointsUsados).toEqual([0]);
    expect(rodar(w, INPUT_VAZIO, 1)).not.toContain('checkpoint');
  });
});

describe('step: documentos', () => {
  it('lido duas vezes conta uma vez', () => {
    const w = criarWorld(FASE);
    const tipos = [
      ...rodar(w, { ...INPUT_VAZIO, usar: true }, 1),
      ...rodar(w, INPUT_VAZIO, 1),
      ...rodar(w, { ...INPUT_VAZIO, usar: true }, 1),
    ];
    expect(tipos.filter((t) => t === 'documento')).toHaveLength(2);
    expect(w.stats.documentos).toEqual(['doc1']);
  });
});

describe('step: ruído chega à IA', () => {
  const mundo = () => {
    const w = criarWorld(faseMinima('##########\n#P.......#\n##########', { saida: [8, 1] }));
    w.jogador.yaw = Math.PI / 2;            // olha para a parede da esquerda
    const i = porInimigo(w, 'funcionario', [6, 1]);
    i.yaw = -Math.PI / 2;                   // de costas para o jogador
    return { w, i };
  };
  it('um tiro do jogador põe em suspeita um inimigo de costas', () => {
    const { w, i } = mundo();
    const tipos = rodar(w, { ...INPUT_VAZIO, atirar: true }, 1);
    expect(tipos).toContain('ruido');
    expect(i.modo).toBe('suspeita');
  });
  it('sem tiro, ele segue em patrulha', () => {
    const { w, i } = mundo();
    rodar(w, INPUT_VAZIO, 1);
    expect(i.modo).toBe('patrulha');
  });
});

describe('step: estado parado', () => {
  it('com a fase concluída, não avança o tempo', () => {
    const w = criarWorld(FASE);
    w.estado = 'concluida';
    expect(step(w, { ...INPUT_VAZIO, frente: 1 }, PASSO)).toEqual([]);
    expect(w.t).toBe(0);
    expect(w.stats.tempo).toBe(0);
  });
});
