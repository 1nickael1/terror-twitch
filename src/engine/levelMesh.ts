import { BoxGeometry, Group, Mesh, PlaneGeometry, Vector3 } from 'three';
import { CELL, WALL_HEIGHT, cellAt, cellCenter, findCells, isBlocking, type LevelData } from './levelData';
import type { MaterialBank } from './materials';
import type { Textures } from './textures';

export interface BuiltLevel {
  group: Group;
  lightPositions: Vector3[];
  alarmPosition: Vector3 | null;
}

const DIRS = [
  { dc: 1, dr: 0 },
  { dc: -1, dr: 0 },
  { dc: 0, dr: 1 },
  { dc: 0, dr: -1 },
];

export function buildLevel(level: LevelData, bank: MaterialBank, tex: Textures): BuiltLevel {
  const group = new Group();
  const add = (mesh: Mesh, slot: string, castShadow = true): Mesh => {
    bank.use(mesh, slot);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  const w = level.cols * CELL;
  const h = level.rowCount * CELL;
  tex.piso.repeat.set(level.cols, level.rowCount);
  tex.teto.repeat.set(level.cols, level.rowCount);
  add(new Mesh(new PlaneGeometry(w, h).rotateX(-Math.PI / 2)), 'piso', false).position.set(w / 2, 0, h / 2);
  add(new Mesh(new PlaneGeometry(w, h).rotateX(Math.PI / 2)), 'teto', false).position.set(w / 2, WALL_HEIGHT, h / 2);

  const wallGeo = new BoxGeometry(CELL, WALL_HEIGHT, CELL);
  let placaN = 0;
  for (let row = 0; row < level.rowCount; row++) {
    for (let col = 0; col < level.cols; col++) {
      const ch = cellAt(level, col, row);
      if (ch !== '#' && ch !== 'C') continue;
      const open = DIRS.filter((d) => !isBlocking(level, col + d.dc, row + d.dr));
      if (open.length === 0) continue;
      const c = cellCenter({ col, row });
      add(new Mesh(wallGeo), ch === 'C' ? 'porta' : 'parede').position.set(c.x, WALL_HEIGHT / 2, c.z);
      if (ch !== 'C') continue;
      for (const d of open) {
        placaN++;
        const yaw = Math.atan2(d.dc, d.dr); // planos olham +z; gira para a face aberta
        const slot = `placa-${placaN}`;
        bank.define(slot, { map: tex.placa(`CELA ${String(placaN).padStart(2, '0')}`), roughness: 0.6 });
        const placa = add(new Mesh(new PlaneGeometry(0.9, 0.45)), slot, false);
        placa.position.set(c.x + d.dc * (CELL / 2 + 0.01), 2.55, c.z + d.dr * (CELL / 2 + 0.01));
        placa.rotation.y = yaw;
        const faixa = add(new Mesh(new PlaneGeometry(1.8, 0.45).rotateX(-Math.PI / 2)), 'faixa', false);
        faixa.position.set(c.x + d.dc * (CELL / 2 + 0.35), 0.01, c.z + d.dr * (CELL / 2 + 0.35));
        faixa.rotation.y = yaw;
      }
    }
  }

  const lightPositions = findCells(level, 'L').map((cell) => {
    const c = cellCenter(cell);
    add(new Mesh(new BoxGeometry(1.4, 0.06, 0.3)), 'luminaria', false).position.set(c.x, WALL_HEIGHT - 0.03, c.z);
    return new Vector3(c.x, WALL_HEIGHT - 0.25, c.z);
  });

  let alarmPosition: Vector3 | null = null;
  const alarmCell = findCells(level, 'A')[0];
  if (alarmCell) {
    const c = cellCenter(alarmCell);
    add(new Mesh(new BoxGeometry(0.25, 0.15, 0.25)), 'alarme', false).position.set(c.x, WALL_HEIGHT - 0.075, c.z);
    alarmPosition = new Vector3(c.x, WALL_HEIGHT - 0.2, c.z);
  }

  for (const cell of findCells(level, 'T')) {
    const c = cellCenter(cell);
    add(new Mesh(new BoxGeometry(1.6, 0.06, 0.9)), 'metal').position.set(c.x, 0.82, c.z);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      add(new Mesh(new BoxGeometry(0.05, 0.8, 0.05)), 'metal').position.set(c.x + sx * 0.72, 0.4, c.z + sz * 0.38);
    }
    add(new Mesh(new BoxGeometry(0.55, 0.4, 0.08)), 'metal').position.set(c.x, 1.1, c.z - 0.15);
    add(new Mesh(new PlaneGeometry(0.47, 0.32)), 'tela', false).position.set(c.x, 1.1, c.z - 0.15 + 0.041);
  }

  for (const cell of findCells(level, 'D')) {
    const c = cellCenter(cell);
    const slab = add(new Mesh(new BoxGeometry(1.7, 0.1, 2.6)), 'porta');
    slab.position.set(c.x + 0.3, 0.05, c.z + CELL * 0.9);
    slab.rotation.y = 0.35;
    for (const dz of [-1, 1]) {
      add(new Mesh(new PlaneGeometry(1.8, 0.45).rotateX(-Math.PI / 2)), 'faixa', false).position.set(
        c.x,
        0.012,
        c.z + dz * (CELL / 2 - 0.3),
      );
    }
  }

  return { group, lightPositions, alarmPosition };
}
