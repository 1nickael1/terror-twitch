import { Color, Mesh, PCFShadowMap, PerspectiveCamera, Scene, WebGLRenderer, type Material } from 'three';
import { PostPipeline } from '../looks/pipeline';
import type { SceneContext, VisualStyle } from '../looks/types';
import { Input } from './input';
import { parseLevel, type LevelData } from './levelData';
import { buildLevel } from './levelMesh';
import { LightRig } from './lights';
import { MAPA, SPAWN_YAW } from './mapa';
import { createMaterialBank, type MaterialBank } from './materials';
import { createMonster, updateMonster, type MonsterState } from './monster';
import { MonsterView } from './monsterView';
import { applyLook, stepPlayer, WALK_SPEED, type PlayerState } from './player';
import { createTextures } from './textures';
import { Weapon } from './weapon';

export type EngineEvent =
  | { type: 'estilo'; id: string }
  | { type: 'travado'; travado: boolean }
  | { type: 'pegou' }
  | { type: 'reiniciou' };

export class WebGL2IndisponivelError extends Error {
  constructor() {
    super('Seu navegador não tem WebGL2 disponível. Tente o Chrome, o Edge ou o Firefox atualizados.');
  }
}

const EYE_HEIGHT = 1.6;

export class Engine {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(75, 1, 0.05, 100);
  private readonly bank: MaterialBank;
  private readonly lights: LightRig;
  private readonly pipeline: PostPipeline;
  private readonly input: Input;
  private readonly level: LevelData;
  private readonly ctx: SceneContext;
  private readonly listeners = new Set<(e: EngineEvent) => void>();
  private readonly resizeObserver: ResizeObserver;
  private player: PlayerState;
  private monster: MonsterState;
  private readonly monsterView: MonsterView;
  private readonly weapon: Weapon;
  private style: VisualStyle;
  private raf = 0;
  private last = 0;
  private time = 0;
  private walkPhase = 0;
  private moveAmount = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly styles: readonly VisualStyle[],
    initialStyleId: string,
  ) {
    const gl = canvas.getContext('webgl2', { antialias: false, powerPreference: 'high-performance' });
    if (!gl) throw new WebGL2IndisponivelError();
    this.renderer = new WebGLRenderer({ canvas, context: gl });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;

    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    this.level = parseLevel(MAPA);
    this.player = { pos: { ...this.level.playerSpawn }, yaw: SPAWN_YAW, pitch: 0 };

    const textures = createTextures();
    this.bank = createMaterialBank(textures);
    const built = buildLevel(this.level, this.bank, textures);
    this.scene.add(built.group);
    this.lights = new LightRig(this.scene, this.camera, built.lightPositions, built.alarmPosition);
    this.ctx = { scene: this.scene, bank: this.bank, lights: this.lights };
    this.monster = createMonster(this.level.monsterSpawn);
    this.monsterView = new MonsterView(this.bank);
    this.scene.add(this.monsterView.root);
    this.weapon = new Weapon(this.camera, this.bank);

    this.pipeline = new PostPipeline(this.renderer);
    this.input = new Input(canvas, (travado) => this.emit({ type: 'travado', travado }));
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();

    this.style = this.findStyle(initialStyleId) ?? styles[0];
    this.applyStyle(this.style);
  }

  get styleId(): string {
    return this.style.id;
  }

  on(listener: (e: EngineEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(): void {
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  setStyle(id: string): void {
    const s = this.findStyle(id);
    if (!s || s === this.style) return;
    this.style = s;
    this.applyStyle(s);
    this.emit({ type: 'estilo', id: s.id });
  }

  reset(): void {
    this.player = { pos: { ...this.level.playerSpawn }, yaw: SPAWN_YAW, pitch: 0 };
    this.monster = createMonster(this.level.monsterSpawn);
    this.emit({ type: 'reiniciou' });
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.input.dispose();
    this.listeners.clear();
    this.scene.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      o.geometry.dispose();
      const m = o.material as Material | Material[];
      (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
    });
    this.bank.dispose();
    this.pipeline.dispose();
    this.renderer.dispose();
  }

  private findStyle(id: string): VisualStyle | undefined {
    return this.styles.find((s) => s.id === id);
  }

  private applyStyle(s: VisualStyle): void {
    this.scene.fog = null;
    this.scene.background = new Color(0x000000);
    this.bank.setKind('standard');
    this.bank.setNearest(false);
    this.lights.apply({});
    s.aplicar(this.ctx);
    this.pipeline.setStyle(s);
  }

  private emit(e: EngineEvent): void {
    for (const l of this.listeners) l(e);
  }

  private resize(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const pr = this.renderer.getPixelRatio();
    this.pipeline.resize(Math.round(w * pr), Math.round(h * pr));
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min((now - this.last) / 1000, 0.1); // aba oculta não "teleporta"
    this.last = now;
    if (dt <= 0) return;
    this.time += dt;
    this.update(dt);
    this.pipeline.render(this.scene, this.camera, this.time);
  };

  private update(dt: number): void {
    const look = this.input.consumeLook(dt);
    this.player = applyLook(this.player, look.dYaw, look.dPitch);

    const key = this.input.consumeStyleKey();
    if (key) {
      const s = this.styles.find((x) => x.key === key);
      if (s) this.setStyle(s.id);
    }
    if (this.input.consumeReset()) this.reset();

    const preso = this.monster.mode === 'pegou';
    const before = this.player.pos;
    if (!preso) this.player = stepPlayer(this.level, this.player, this.input.moveInput(), dt);
    const speed = Math.hypot(this.player.pos.x - before.x, this.player.pos.z - before.z) / dt;
    this.moveAmount = speed / WALK_SPEED;
    this.walkPhase += dt * speed * 2.2;

    const bob = Math.sin(this.walkPhase) * 0.035 * Math.min(this.moveAmount, 1);
    this.camera.position.set(this.player.pos.x, EYE_HEIGHT + bob, this.player.pos.z);
    this.camera.rotation.set(this.player.pitch, this.player.yaw, 0);
    this.camera.updateMatrixWorld();

    if (this.input.consumeFire() && !preso) {
      this.weapon.fire();
      this.lights.flashMuzzle();
    }

    const r = updateMonster(
      this.monster,
      { level: this.level, playerPos: this.player.pos, playerYaw: this.player.yaw },
      dt,
    );
    this.monster = r.state;
    if (r.event === 'pegou') this.emit({ type: 'pegou' });
    if (r.event === 'reiniciar') this.reset();

    this.monsterView.sync(this.monster, this.time);
    this.weapon.update(dt, this.time, this.moveAmount);
    this.lights.update(this.time, dt, this.camera);
  }
}
