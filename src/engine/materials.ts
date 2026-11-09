import {
  LinearFilter, LinearMipmapLinearFilter, MeshLambertMaterial, MeshStandardMaterial, NearestFilter,
  type Material, type Mesh, type Texture,
} from 'three';
import type { Textures } from './textures';

export interface SlotDef {
  color?: number;
  map?: Texture;
  emissive?: number;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
}

export type MaterialKind = 'lambert' | 'standard';

/** Guarda cada "slot" de material nas duas variantes e troca todas as malhas registradas de uma vez. */
export class MaterialBank {
  kind: MaterialKind = 'standard';
  private readonly defs = new Map<string, SlotDef>();
  private readonly cache = new Map<string, Material>();
  private readonly users = new Map<string, Mesh[]>();
  private readonly textures = new Set<Texture>();

  define(slot: string, def: SlotDef): void {
    this.defs.set(slot, def);
    if (def.map) this.textures.add(def.map);
  }

  use<T extends Mesh>(mesh: T, slot: string): T {
    const list = this.users.get(slot) ?? [];
    list.push(mesh);
    this.users.set(slot, list);
    mesh.material = this.get(slot);
    return mesh;
  }

  get(slot: string): Material {
    const key = `${this.kind}:${slot}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const d = this.defs.get(slot);
    if (!d) throw new Error(`Slot de material desconhecido: ${slot}`);
    const base = {
      color: d.color ?? 0xffffff,
      map: d.map ?? null,
      emissive: d.emissive ?? 0x000000,
      emissiveIntensity: d.emissiveIntensity ?? 1,
    };
    const m: Material =
      this.kind === 'lambert'
        ? new MeshLambertMaterial(base)
        : new MeshStandardMaterial({ ...base, roughness: d.roughness ?? 0.8, metalness: d.metalness ?? 0 });
    this.cache.set(key, m);
    return m;
  }

  setKind(kind: MaterialKind): void {
    if (kind === this.kind) return;
    this.kind = kind;
    for (const [slot, meshes] of this.users) {
      const m = this.get(slot);
      for (const mesh of meshes) mesh.material = m;
    }
  }

  setNearest(on: boolean): void {
    for (const t of this.textures) {
      t.magFilter = on ? NearestFilter : LinearFilter;
      t.minFilter = on ? NearestFilter : LinearMipmapLinearFilter;
      t.needsUpdate = true;
    }
  }

  dispose(): void {
    for (const m of this.cache.values()) m.dispose();
    for (const t of this.textures) t.dispose();
    this.cache.clear();
  }
}

export function createMaterialBank(t: Textures): MaterialBank {
  const b = new MaterialBank();
  b.define('parede', { map: t.concreto, roughness: 0.95 });
  b.define('piso', { map: t.piso, roughness: 0.75, metalness: 0.1 });
  b.define('teto', { map: t.teto, roughness: 0.9 });
  b.define('faixa', { map: t.faixa, roughness: 0.7 });
  b.define('porta', { map: t.porta, roughness: 0.55, metalness: 0.3 });
  b.define('metal', { color: 0x3a3d42, roughness: 0.5, metalness: 0.3 });
  b.define('tela', { color: 0x061206, emissive: 0x39ff6a, emissiveIntensity: 0.9 });
  b.define('luminaria', { color: 0xffffff, emissive: 0xeef4ff, emissiveIntensity: 3 });
  b.define('alarme', { color: 0x300000, emissive: 0xff1a1a, emissiveIntensity: 3 });
  b.define('monstro', { color: 0xd9d3c7, roughness: 0.95 });
  b.define('vazio', { color: 0x050505, roughness: 1 });
  b.define('arma', { color: 0x2a2c30, roughness: 0.45, metalness: 0.3 });
  return b;
}
