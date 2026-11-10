import {
  DoubleSide, FrontSide, LinearFilter, LinearMipmapLinearFilter, MeshLambertMaterial, MeshStandardMaterial,
  NearestFilter, type Material, type Mesh, type Texture,
} from 'three';
import type { Textures } from './textures';
import { CORES_CARTAO } from './coresCartao';

export interface SlotDef {
  color?: number;
  map?: Texture;
  emissive?: number;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
  /** < 1 deixa o material translúcido (sem escrita de profundidade) */
  opacity?: number;
  ladoDuplo?: boolean;
  /** decalque: alfa da textura, sem escrita de profundidade e com `polygonOffset` (fica por cima da superfície) */
  decal?: boolean;
  /** multiplica a cor pelo atributo `color` da geometria (peças unidas com cores diferentes) */
  vertexColors?: boolean;
}

export type MaterialKind = 'lambert' | 'standard';

type MaterialDoBanco = MeshLambertMaterial | MeshStandardMaterial;

/**
 * Guarda cada "slot" de material nas duas variantes e troca todas as malhas registradas de uma vez.
 * O banco vive com o `Engine`; quem registra malhas com `use` as solta com `soltar` ao descartá-las.
 */
export class MaterialBank {
  kind: MaterialKind = 'standard';
  private emissivo = 1;
  private nearest = false;
  private readonly defs = new Map<string, SlotDef>();
  private readonly cache = new Map<string, MaterialDoBanco>();
  private readonly users = new Map<string, Set<Mesh>>();
  private readonly textures = new Set<Texture>();
  /** brilho variável por slot (lâmpadas dos perigos), multiplicado ao emissivo do slot e ao do filtro */
  private readonly brilhos = new Map<string, number>();

  define(slot: string, def: SlotDef): void {
    this.defs.set(slot, def);
    if (def.map) {
      this.textures.add(def.map);
      this.filtrar(def.map);
    }
  }

  /**
   * Esquece um slot definido por uma fase (decalques): libera os materiais dele e solta a
   * textura sem descartá-la (ela é de quem definiu o slot).
   */
  removerSlot(slot: string): void {
    const d = this.defs.get(slot);
    if (!d) return;
    this.defs.delete(slot);
    this.brilhos.delete(slot);
    for (const kind of ['lambert', 'standard'] as const) {
      const key = `${kind}:${slot}`;
      this.cache.get(key)?.dispose();
      this.cache.delete(key);
    }
    this.users.delete(slot);
    if (d.map) this.textures.delete(d.map);
  }

  use<T extends Mesh>(mesh: T, slot: string): T {
    const set = this.users.get(slot) ?? new Set<Mesh>();
    set.add(mesh);
    this.users.set(slot, set);
    mesh.material = this.get(slot);
    return mesh;
  }

  /** Esquece a malha (ela continua com o material atual, que pertence ao banco). */
  soltar(mesh: Mesh): void {
    for (const set of this.users.values()) set.delete(mesh);
  }

  get(slot: string): Material {
    const key = `${this.kind}:${slot}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const d = this.defs.get(slot);
    if (!d) throw new Error(`Slot de material desconhecido: ${slot}`);
    const translucido = d.decal === true || (d.opacity !== undefined && d.opacity < 1);
    const base = {
      color: d.color ?? 0xffffff,
      map: d.map ?? null,
      emissive: d.emissive ?? 0x000000,
      emissiveIntensity: this.intensidade(slot, d),
      transparent: translucido,
      opacity: d.opacity ?? 1,
      depthWrite: !translucido,
      side: d.ladoDuplo ? DoubleSide : FrontSide,
      vertexColors: d.vertexColors === true,
      ...(d.decal ? { polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, alphaTest: 0.02 } : {}),
    };
    const m: MaterialDoBanco =
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
    this.nearest = on;
    for (const t of this.textures) this.filtrar(t);
  }

  private filtrar(t: Texture): void {
    t.magFilter = this.nearest ? NearestFilter : LinearFilter;
    t.minFilter = this.nearest ? NearestFilter : LinearMipmapLinearFilter;
    t.needsUpdate = true;
  }

  /** Multiplicador do brilho emissivo de todos os slots (vem do filtro). */
  setEmissivo(mult: number): void {
    if (mult === this.emissivo) return;
    this.emissivo = mult;
    for (const [key, m] of this.cache) {
      const slot = key.slice(key.indexOf(':') + 1);
      m.emissiveIntensity = this.intensidade(slot, this.defs.get(slot));
    }
  }

  /**
   * Brilho variável (0..) de um slot: multiplica o `emissiveIntensity` dele (lâmpadas dos perigos piscando).
   * Vale para as duas variantes (lambert/standard) e segue o multiplicador do filtro (`setEmissivo`).
   */
  ajustarBrilho(slot: string, k: number): void {
    if (!this.defs.has(slot) || this.brilhos.get(slot) === k) return;
    this.brilhos.set(slot, k);
    const d = this.defs.get(slot);
    for (const kind of ['lambert', 'standard'] as const) {
      const m = this.cache.get(`${kind}:${slot}`);
      if (m) m.emissiveIntensity = this.intensidade(slot, d);
    }
  }

  private intensidade(slot: string, d: SlotDef | undefined): number {
    return (d?.emissiveIntensity ?? 1) * (this.brilhos.get(slot) ?? 1) * this.emissivo;
  }

  dispose(): void {
    for (const m of this.cache.values()) m.dispose();
    for (const t of this.textures) t.dispose();
    this.cache.clear();
    this.users.clear();
  }
}

/** Cor da faixa de porta e do cartão por nível exigido (0 = sem exigência). */
export const COR_NIVEL: readonly number[] = [0x7a7d80, CORES_CARTAO[1].hex, CORES_CARTAO[2].hex, CORES_CARTAO[3].hex];

export function createMaterialBank(t: Textures): MaterialBank {
  const b = new MaterialBank();
  // estrutura da fase
  b.define('parede', { map: t.concreto, roughness: 0.95 });
  // revestimento `azulejo` (ambiente.revestimento): esmalte um pouco mais liso que o concreto
  b.define('parede-azulejo', { map: t.azulejo, roughness: 0.55, metalness: 0.05 });
  b.define('piso', { map: t.piso, roughness: 0.75, metalness: 0.1 });
  b.define('teto', { map: t.teto, roughness: 0.9 });
  b.define('degrau', { map: t.concreto, color: 0x9a948a, roughness: 0.9 });
  b.define('vidro', { color: 0x8fb8c8, roughness: 0.05, metalness: 0.1, opacity: 0.22, ladoDuplo: true });
  b.define('grade', { color: 0x2c2f33, roughness: 0.45, metalness: 0.5 });
  b.define('tubo', { color: 0x5a5f56, roughness: 0.5, metalness: 0.4 });
  b.define('porta', { map: t.porta, roughness: 0.55, metalness: 0.3 });
  b.define('metal', { color: 0x3a3d42, roughness: 0.5, metalness: 0.3 });
  b.define('tela', { color: 0x061206, emissive: 0x39ff6a, emissiveIntensity: 0.9 });
  b.define('papel', { color: 0xe8e4d6, emissive: 0xe8e4d6, emissiveIntensity: 0.12, roughness: 0.95 });
  b.define('vazio', { color: 0x050505, roughness: 1 });
  // viewmodels das armas: um pouco emissivos para não sumirem no escuro
  b.define('arma', { color: 0x2a2c30, emissive: 0x2a2c30, emissiveIntensity: 0.25, roughness: 0.45, metalness: 0.3 });
  b.define('arma-detalhe', { color: 0x55595f, emissive: 0x55595f, emissiveIntensity: 0.2, roughness: 0.35, metalness: 0.5 });
  b.define('arma-cabo', { color: 0x2e2620, emissive: 0x2e2620, emissiveIntensity: 0.12, roughness: 0.85 });
  b.define('arma-capsula', { color: 0x4fb07a, emissive: 0x4fb07a, emissiveIntensity: 0.45, roughness: 0.4 });
  b.define('arma-mira', { color: 0xff5a2a, emissive: 0xff5a2a, emissiveIntensity: 1.2 });
  COR_NIVEL.forEach((cor, nivel) => b.define(`nivel-${nivel}`, { color: cor, emissive: cor, emissiveIntensity: 0.35 }));
  // pickups: um pouco emissivos para serem achados no escuro
  b.define('pk-vida', { color: 0x2ecc55, emissive: 0x2ecc55, emissiveIntensity: 0.45 });
  b.define('pk-colete', { color: 0x2f6fe0, emissive: 0x2f6fe0, emissiveIntensity: 0.35, metalness: 0.3 });
  b.define('pk-balas', { color: 0xc8a040, emissive: 0xc8a040, emissiveIntensity: 0.25 });
  b.define('pk-cartuchos', { color: 0xc03a2a, emissive: 0xc03a2a, emissiveIntensity: 0.25 });
  b.define('pk-leves', { color: 0x8a9a3a, emissive: 0x8a9a3a, emissiveIntensity: 0.25 });
  b.define('pk-capsulas', { color: 0x40a0a0, emissive: 0x40a0a0, emissiveIntensity: 0.3 });
  b.define('pk-arma', { color: 0x3a3d42, emissive: 0x6a7080, emissiveIntensity: 0.3, metalness: 0.4, roughness: 0.4 });
  // inimigos
  // as cores de cada peça vão no atributo `color` das geometrias unidas (view/inimigosModelos.ts)
  b.define('ini-corpo', { color: 0xffffff, roughness: 0.85, vertexColors: true });
  b.define('ini-olho', { color: 0xd8e6b0, emissive: 0xd8e6b0, emissiveIntensity: 0.7 });
  b.define('ini-visor', { color: 0xff7a3a, emissive: 0xff6a2a, emissiveIntensity: 0.8 });
  b.define('ini-dor', { color: 0xffffff, emissive: 0xffe0d0, emissiveIntensity: 1.6 });
  return b;
}
