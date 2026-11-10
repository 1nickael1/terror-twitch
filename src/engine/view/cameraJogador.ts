// Câmera em primeira pessoa: olhos interpolados entre o passo anterior e o atual, com balanço ao andar.
import type { PerspectiveCamera } from 'three';
import { JOGADOR } from '../../sim/balance';
import type { Jogador } from '../../sim/world';

const BALANCO_AMPLITUDE = 0.035;
const BALANCO_FREQ = 2.2;
/** acima disso entre dois passos é teleporte: não interpola */
const SALTO_TELEPORTE = 1;
const SEM_GIRO = { dYaw: 0, dPitch: 0 };

export class CameraJogador {
  /** posição dos pés antes do último passo (para interpolar) */
  private anterior = { x: 0, y: 0, z: 0 };
  private balancoFase = 0;

  constructor(private readonly camera: PerspectiveCamera) {
    camera.rotation.order = 'YXZ';
  }

  /** Guarda a posição atual como "antes do passo" (chamar antes de cada `step`). */
  marcarAnterior(j: Jogador): void {
    this.anterior = { x: j.pos.x, y: j.y, z: j.pos.z };
  }

  /** Teleporte (fase nova, checkpoint): sem interpolação nem balanço herdados. */
  teleportar(j: Jogador): void {
    this.marcarAnterior(j);
    this.balancoFase = 0;
    this.atualizar(j, 1, 0, false);
  }

  /**
   * `alfa`: fração do passo desde o último `step`; `andando`: a simulação está rodando;
   * `pendente`: giro do mouse ainda não entregue à simulação (o olhar acompanha telas de 120–144 Hz).
   */
  atualizar(j: Jogador, alfa: number, dt: number, andando: boolean, pendente = SEM_GIRO): void {
    const a = this.anterior;
    const pulo = Math.hypot(j.pos.x - a.x, j.y - a.y, j.pos.z - a.z);
    const t = pulo > SALTO_TELEPORTE ? 1 : Math.min(1, Math.max(0, alfa));
    const velocidade = j.noChao ? Math.hypot(j.vel.x, j.vel.z) : 0;
    if (andando) this.balancoFase += dt * velocidade * BALANCO_FREQ;
    const balanco = Math.sin(this.balancoFase) * BALANCO_AMPLITUDE * Math.min(velocidade / JOGADOR.velocidadeDevagar, 1);
    this.camera.position.set(
      a.x + (j.pos.x - a.x) * t,
      a.y + (j.y - a.y) * t + JOGADOR.olhos + balanco,
      a.z + (j.pos.z - a.z) * t,
    );
    const pitch = Math.max(-JOGADOR.pitchMax, Math.min(JOGADOR.pitchMax, j.pitch + pendente.dPitch));
    this.camera.rotation.set(pitch, j.yaw + pendente.dYaw, 0);
    this.camera.updateMatrixWorld();
  }
}
