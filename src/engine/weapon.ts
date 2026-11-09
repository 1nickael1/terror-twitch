import {
  AdditiveBlending, BoxGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, type Camera,
} from 'three';
import type { MaterialBank } from './materials';

const BASE = { x: 0.17, y: -0.16, z: -0.33 };

/** Pistola placeholder em 1ª pessoa: balança ao andar, recua e solta um flash ao atirar (sem dano). */
export class Weapon {
  readonly root = new Group();
  private readonly flash: Mesh;
  private kick = 0;
  private flashTime = 0;

  constructor(camera: Camera, bank: MaterialBank) {
    const part = (w: number, h: number, d: number, slot: string, x: number, y: number, z: number) => {
      const m = bank.use(new Mesh(new BoxGeometry(w, h, d)), slot);
      m.position.set(x, y, z);
      this.root.add(m);
      return m;
    };
    part(0.055, 0.065, 0.26, 'arma', 0, 0, -0.02);
    part(0.05, 0.04, 0.2, 'arma', 0, -0.045, 0);
    part(0.048, 0.13, 0.06, 'arma', 0, -0.11, 0.07).rotation.x = -0.25;
    part(0.02, 0.02, 0.02, 'vazio', 0, 0.005, -0.155);

    this.flash = new Mesh(
      new PlaneGeometry(0.12, 0.12),
      new MeshBasicMaterial({ color: 0xffd27a, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
    );
    // logo à frente do cano (a luz MUZZLE_LOCAL fica ~2 cm adiante, no espaço da câmera)
    this.flash.position.set(0, 0.005, -0.2);
    this.flash.visible = false;
    this.root.add(this.flash);

    this.root.position.set(BASE.x, BASE.y, BASE.z);
    camera.add(this.root);
  }

  fire(): void {
    this.kick = 1;
    this.flashTime = 0.05;
    this.flash.rotation.z = Math.random() * Math.PI;
  }

  update(dt: number, t: number, moveAmount: number): void {
    this.kick *= Math.exp(-dt * 14);
    this.flashTime -= dt;
    this.flash.visible = this.flashTime > 0;
    const bob = Math.min(moveAmount, 1.7);
    this.root.position.set(
      BASE.x + Math.sin(t * 9) * 0.01 * bob,
      BASE.y + Math.abs(Math.cos(t * 9)) * 0.008 * bob - this.kick * 0.01,
      BASE.z + this.kick * 0.05,
    );
    this.root.rotation.x = this.kick * 0.3;
  }
}
