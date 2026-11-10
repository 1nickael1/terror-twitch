import { describe, expect, it } from 'vitest';
import { lacosDaFase } from '../../src/audio/regras';
import { SIRENE } from '../../src/sim/balance';
import { step } from '../../src/sim/step';
import { executar } from '../../src/sim/triggers';
import { criarWorld, INPUT_VAZIO, restaurarCheckpoint, gravarCheckpoint } from '../../src/sim/world';
import { faseMinima } from './ajuda';

const PLANTA = ['#######', '#P....#', '#######'].join('\n');
// saída longe do P: senão a fase conclui no primeiro passo e o `step` para de avançar
const mundo = () => criarWorld(faseMinima(PLANTA, { saida: [5, 1] }));

describe('sirene (o som do alarme toca por um tempo; as luzes seguem o alarme)', () => {
  it('ligar o alarme arma a sirene pela duração configurada', () => {
    const w = mundo();
    expect(w.sirene).toBe(0);
    executar(w, { acao: 'alarme', ligado: true });
    expect(w.alarme).toBe(true);
    expect(w.sirene).toBe(SIRENE.duracao);
  });

  it('desligar o alarme cala a sirene na hora', () => {
    const w = mundo();
    executar(w, { acao: 'alarme', ligado: true });
    executar(w, { acao: 'alarme', ligado: false });
    expect(w.sirene).toBe(0);
  });

  it('a sirene se esgota com o tempo, mas o alarme (luzes) continua ligado', () => {
    const w = mundo();
    executar(w, { acao: 'alarme', ligado: true });
    for (let t = 0; t < SIRENE.duracao + 1; t += 1 / 60) step(w, INPUT_VAZIO, 1 / 60);
    expect(w.sirene).toBe(0);
    expect(w.alarme).toBe(true);
    expect(lacosDaFase(w).alarme).toBe(false);
  });

  it('o laço do alarme só toca com o alarme ligado e sirene restante', () => {
    const w = mundo();
    executar(w, { acao: 'alarme', ligado: true });
    expect(lacosDaFase(w).alarme).toBe(true);
    w.sirene = 0;
    expect(lacosDaFase(w).alarme).toBe(false);
  });

  it('religar o alarme já ligado rearma a sirene', () => {
    const w = mundo();
    executar(w, { acao: 'alarme', ligado: true });
    w.sirene = 1;
    executar(w, { acao: 'alarme', ligado: true });
    expect(w.sirene).toBe(SIRENE.duracao);
  });

  it('o checkpoint guarda a sirene restante', () => {
    const w = mundo();
    executar(w, { acao: 'alarme', ligado: true });
    w.sirene = 3;
    gravarCheckpoint(w);
    w.sirene = 0;
    restaurarCheckpoint(w);
    expect(w.sirene).toBe(3);
  });
});
