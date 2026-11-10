// Luzes da engine que não dependem da fase: ambiente, lanterna do jogador (cone principal com
// sombra + luz de borda larga sem sombra), iluminador infravermelho e clarão de cano (`ClaraoCano`).
// As luzes da fase (LuzDef, alarme) ficam em `view/luzes.ts`, criadas pelo LevelRuntime.
import { AmbientLight, Object3D, PointLight, SpotLight, Vector3, type Camera, type Scene } from 'three';
import type { Qualidade } from '../save/opcoes';
import type { AjusteCena } from '../looks/types';
import { solidoDe } from '../sim/doors';
import { alcanceTiro } from '../sim/grid';
import type { World } from '../sim/world';

/**
 * Intensidade da lanterna com multiplicador 1 (o filtro Lanterna), com decaimento linear
 * (`decay` 1): uma parede a 10 m ainda aparece através da névoa do filtro Lanterna.
 */
export const LANTERNA_BASE = 9;
const DECAY_LANTERNA = 1;
const ALCANCE_LANTERNA = 30;
/** o cone é da engine (igual em todos os filtros): meio-ângulo e penumbra */
export const ANGULO_LANTERNA = 0.75;
export const PENUMBRA_LANTERNA = 0.6;
/** luz de borda: cone largo, sem sombra, fração da intensidade principal */
export const ANGULO_BORDA = 1.2;
export const FRACAO_BORDA = 0.15;
/** atenuação de campo próximo: fator = min(1, (d / D)²), nunca abaixo do piso */
const DISTANCIA_PLENA = 2;
const PISO_PERTO = 0.15;
const SUAVE_PERTO = 12; // 1/s
const SUAVE_ALVO = 30; // 1/s
const COR_AMBIENTE_PADRAO = 0x9aa4b0;

/** Lado do mapa de sombra da lanterna por qualidade (0 = sem sombra). */
export const SOMBRA_POR_QUALIDADE: Record<Qualidade, number> = { baixa: 0, media: 512, alta: 1024 };

/** Fator de campo próximo para a distância `d` (m) até a superfície no eixo da câmera. */
export function fatorPerto(d: number): number {
  return Math.max(PISO_PERTO, Math.min(1, (d / DISTANCIA_PLENA) ** 2));
}

export class LightRig {
  readonly ambient = new AmbientLight();
  readonly flashlight = new SpotLight(0xfff2d8, 0, ALCANCE_LANTERNA, ANGULO_LANTERNA, PENUMBRA_LANTERNA, DECAY_LANTERNA);
  readonly borda = new SpotLight(0xfff2d8, 0, ALCANCE_LANTERNA, ANGULO_BORDA, 1, DECAY_LANTERNA);
  readonly infrared = new PointLight(0xffffff, 0, 22, 1.2);
  private readonly flashTarget = new Object3D();
  private lanternaMax = 0;
  private perto = 1;
  private iniciado = false;
  private readonly tmpPos = new Vector3();
  private readonly tmpDir = new Vector3();

  constructor(private readonly scene: Scene, private readonly camera: Camera) {
    scene.add(this.ambient, this.flashTarget);
    // à esquerda, um pouco acima e recuada do olho: o disco de perto fica menos duro. O
    // deslocamento horizontal (hypot(0,2; 0,12) ≈ 0,23 m) fica dentro do raio do jogador (0,3 m):
    // de costas para a parede, a origem não passa para trás dela
    this.flashlight.position.set(-0.2, 0.1, 0.12);
    this.flashlight.target = this.flashTarget;
    this.flashlight.shadow.camera.near = 0.1;
    this.flashlight.shadow.camera.far = 25;
    this.flashlight.shadow.bias = -0.0005;
    this.borda.position.copy(this.flashlight.position);
    this.borda.target = this.flashTarget;
    camera.add(this.flashlight, this.borda, this.infrared);
  }

  /** Aplica o filtro combinado com a luz ambiente da fase (0 sem fase carregada). */
  aplicar(cena: AjusteCena, ambienteFase: number): void {
    this.ambient.color.setHex(cena.corAmbiente ?? COR_AMBIENTE_PADRAO);
    this.ambient.intensity = ambienteFase * cena.ambiente;
    this.lanternaMax = LANTERNA_BASE * cena.lanterna;
    this.infrared.intensity = cena.infravermelho;
  }

  /** Liga ou desliga a sombra da lanterna e ajusta a resolução do mapa (a borda nunca tem sombra). */
  definirSombra(lado: number): void {
    const liga = lado > 0;
    if (liga && this.flashlight.shadow.mapSize.x !== lado) {
      this.flashlight.shadow.map?.dispose();
      this.flashlight.shadow.map = null;
      this.flashlight.shadow.mapSize.set(lado, lado);
    }
    this.flashlight.castShadow = liga;
  }

  /** Segue a câmera e o estado da lanterna do jogador; atenua de perto de uma parede. */
  atualizar(world: World, dt: number): void {
    this.camera.getWorldPosition(this.tmpPos);
    this.camera.getWorldDirection(this.tmpDir);
    const alvoPerto = fatorPerto(this.distanciaNoEixo(world));
    this.perto = this.iniciado ? this.perto + (alvoPerto - this.perto) * (1 - Math.exp(-dt * SUAVE_PERTO)) : alvoPerto;
    const i = world.jogador.lanterna ? this.lanternaMax * this.perto : 0;
    this.flashlight.intensity = i;
    this.borda.intensity = i * FRACAO_BORDA;

    this.tmpPos.addScaledVector(this.tmpDir, 6);
    if (!this.iniciado) {
      this.flashTarget.position.copy(this.tmpPos);
      this.iniciado = true;
    } else {
      this.flashTarget.position.lerp(this.tmpPos, 1 - Math.exp(-dt * SUAVE_ALVO));
    }
  }

  /** Teleporte da câmera (fase nova, checkpoint): alvo e atenuação pulam junto. */
  reposicionar(): void {
    this.iniciado = false;
  }

  dispose(): void {
    this.camera.remove(this.flashlight, this.borda, this.infrared);
    this.scene.remove(this.ambient, this.flashTarget);
    this.flashlight.dispose();
    this.borda.dispose();
    this.infrared.dispose();
    this.ambient.dispose();
  }

  /** Distância (m, em 3D) até a primeira superfície no eixo da câmera, pela grade da simulação. */
  private distanciaNoEixo(world: World): number {
    const d = this.tmpDir;
    const horiz = Math.hypot(d.x, d.z);
    if (horiz < 1e-3) return Math.abs((d.y < 0 ? this.tmpPos.y - world.jogador.y : 3) / (d.y || 1));
    const h = alcanceTiro(
      world.grid, { x: this.tmpPos.x, z: this.tmpPos.z }, { x: d.x, z: d.z }, ALCANCE_LANTERNA,
      solidoDe(world), this.tmpPos.y, d.y / horiz,
    );
    return h / horiz;
  }
}

/** Clarão de cano: duração (s) e alcance (m) da luz breve a cada tiro. */
const DURACAO_CLARAO = 0.06;
const ALCANCE_CLARAO = 7;

/**
 * Luz breve do clarão de cano, presa à câmera, criada com a fase (pelo LevelRuntime). Fica
 * sempre na cena com intensidade 0 entre tiros: o número de luzes não muda e nenhum shader é
 * recompilado a cada disparo. Com "reduzir flashes", não acende.
 */
export class ClaraoCano {
  private readonly luz = new PointLight(0xffd59a, 0, ALCANCE_CLARAO, 2);
  private pico = 0;
  private resta = 0;
  private reduzir = false;

  constructor(private readonly camera: Camera) {
    this.luz.position.set(0.09, -0.04, -0.34); // perto do cano das armas em primeira pessoa
    camera.add(this.luz);
  }

  set reduzirFlashes(v: boolean) {
    this.reduzir = v;
    if (v) this.luz.intensity = 0;
  }

  /** Acende com a intensidade e a cor dadas; apaga em `DURACAO_CLARAO`. */
  disparar(intensidade: number, cor: number): void {
    if (this.reduzir) return;
    this.luz.color.setHex(cor);
    this.pico = intensidade;
    this.resta = DURACAO_CLARAO;
  }

  /** Chamar uma vez por quadro, depois de `disparar`: o quadro do tiro sai com a luz cheia. */
  atualizar(dt: number): void {
    this.luz.intensity = this.reduzir ? 0 : this.pico * (this.resta / DURACAO_CLARAO);
    this.resta = Math.max(0, this.resta - dt);
  }

  dispose(): void {
    this.camera.remove(this.luz);
    this.luz.dispose();
  }
}
