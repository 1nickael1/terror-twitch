import { BoxGeometry, CapsuleGeometry, Group, Mesh, SphereGeometry, type BufferGeometry } from 'three';
import type { MaterialBank } from './materials';
import type { MonsterState } from './monster';

/** Humanoide alto (~2,4 m), magro e pálido, braços até abaixo do joelho. Forma original, feita de primitivas. */
export class MonsterView {
  readonly root = new Group();
  private readonly body = new Group();
  private readonly head: Mesh;
  private readonly armL = new Group();
  private readonly armR = new Group();

  constructor(bank: MaterialBank) {
    const part = (geo: BufferGeometry, slot: string, parent: Group | Mesh, x: number, y: number, z = 0) => {
      const m = bank.use(new Mesh(geo), slot);
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    };

    for (const side of [-1, 1]) part(new CapsuleGeometry(0.07, 0.95, 4, 8), 'monstro', this.body, side * 0.1, 0.55);
    part(new BoxGeometry(0.3, 0.15, 0.16), 'monstro', this.body, 0, 1.08);
    part(new CapsuleGeometry(0.15, 0.75, 4, 10), 'monstro', this.body, 0, 1.5).scale.set(1.25, 1, 0.8);
    part(new CapsuleGeometry(0.05, 0.15, 4, 6), 'monstro', this.body, 0, 1.98);

    this.head = part(new SphereGeometry(0.14, 12, 10), 'monstro', this.body, 0, 2.2);
    this.head.scale.set(0.9, 1.15, 1);
    part(new BoxGeometry(0.07, 0.16, 0.03), 'vazio', this.head, 0, -0.05, 0.12);
    for (const side of [-1, 1]) part(new SphereGeometry(0.022, 6, 6), 'vazio', this.head, side * 0.05, 0.04, 0.11);

    for (const [side, pivot] of [[-1, this.armL], [1, this.armR]] as const) {
      pivot.position.set(side * 0.26, 1.85, 0);
      pivot.rotation.z = side * 0.08;
      part(new CapsuleGeometry(0.045, 1.3, 4, 6), 'monstro', pivot, 0, -0.7);
      part(new BoxGeometry(0.08, 0.2, 0.04), 'monstro', pivot, 0, -1.45);
      this.body.add(pivot);
    }

    this.root.add(this.body);
  }

  sync(state: MonsterState, t: number): void {
    this.root.position.set(state.pos.x, 0, state.pos.z);
    this.root.rotation.y = state.yaw;
    if (state.mode === 'perseguicao') {
      const p = t * 14;
      this.body.position.y = Math.abs(Math.sin(p)) * 0.08;
      this.body.rotation.set(0.25, 0, 0);
      this.armL.rotation.x = Math.sin(p) * 0.9;
      this.armR.rotation.x = -Math.sin(p) * 0.9;
      this.head.rotation.z = 0;
    } else {
      this.body.position.y = 0;
      this.body.rotation.set(0, 0, Math.sin(t * 0.8) * 0.03);
      this.armL.rotation.x = 0;
      this.armR.rotation.x = 0;
      this.head.rotation.z = state.mode === 'alerta' ? Math.sin(t * 9) * 0.15 : 0;
    }
  }
}
