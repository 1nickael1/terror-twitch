// Acumulador de passo fixo: converte o tempo real do quadro em passos de `PASSO` da simulação.
import type { SimEvent } from '../sim/eventos';
import { PASSO, step } from '../sim/step';
import type { InputFrame, World } from '../sim/world';
import type { Input } from './input';
import type { CameraJogador } from './view/cameraJogador';

const MAX_PASSOS = 5;

/** Bordas zeradas: os passos depois do primeiro no mesmo quadro só repetem o que está segurado. */
function semBordas(f: InputFrame, seguradas: { atirar: boolean; pular: boolean }): InputFrame {
  return { ...f, ...seguradas, dYaw: 0, dPitch: 0, usar: false, lanterna: false, arma: null, roda: 0 };
}

export class PassoFixo {
  private acumulador = 0;

  /** fração do próximo passo já decorrida (para interpolar a câmera) */
  get alfa(): number {
    return this.acumulador / PASSO;
  }

  zerar(): void {
    this.acumulador = 0;
  }

  /**
   * Roda até 5 passos com o tempo acumulado. O input só é lido quando há passo (assim nenhuma
   * borda se perde); bordas, toques rápidos e giro do mouse valem só no primeiro passo do quadro.
   */
  avancar(w: World, input: Input, olhos: CameraJogador, dt: number): SimEvent[] {
    this.acumulador += dt;
    const passos = Math.min(MAX_PASSOS, Math.floor(this.acumulador / PASSO));
    if (passos === 0) return [];
    const eventos: SimEvent[] = [];
    const quadro = input.ler();
    const resto = semBordas(quadro, input.seguradas());
    for (let k = 0; k < passos; k++) {
      olhos.marcarAnterior(w.jogador);
      eventos.push(...step(w, k === 0 ? quadro : resto, PASSO));
    }
    this.acumulador -= passos * PASSO;
    // ficou para trás (mais de 5 passos): descarta o excesso em vez de acelerar o jogo
    if (this.acumulador >= PASSO) this.acumulador %= PASSO;
    return eventos;
  }
}
