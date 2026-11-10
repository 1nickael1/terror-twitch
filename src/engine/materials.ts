import {
  DoubleSide, FrontSide, LinearFilter, LinearMipmapLinearFilter, MeshLambertMaterial, MeshStandardMaterial,
  NearestFilter, type Material, type Mesh, type Texture, type Vector2,
} from 'three';
import type { Textures } from './textures';
import { CORES_CARTAO } from './coresCartao';

export interface SlotDef {
  color?: number;
  map?: Texture;
  bumpMap?: Texture;
  roughnessMap?: Texture;
  emissiveMap?: Texture;
  normalMap?: Texture;
  normalScale?: Vector2;
  metalnessMap?: Texture;
  emissive?: number;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
  /** Relevo fino da textura do material, em metros. */
  bumpScale?: number;
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
    for (const t of texturasDoSlot(def)) {
      this.textures.add(t);
      this.filtrar(t);
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
    for (const t of texturasDoSlot(d)) {
      if (![...this.defs.values()].some((def) => texturasDoSlot(def).includes(t))) this.textures.delete(t);
    }
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
      bumpMap: d.bumpScale ? d.bumpMap ?? d.map ?? null : null,
      bumpScale: d.bumpScale ?? 0,
      emissive: d.emissive ?? 0x000000,
      emissiveMap: d.emissiveMap ?? null,
      normalMap: d.normalMap ?? null,
      ...(d.normalScale ? { normalScale: d.normalScale } : {}),
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
        : new MeshStandardMaterial({ ...base, roughness: d.roughness ?? 0.8, roughnessMap: d.roughnessMap ?? null, metalness: d.metalness ?? 0, metalnessMap: d.metalnessMap ?? null });
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

function texturasDoSlot(def: SlotDef): Texture[] {
  return [...new Set([def.map, def.bumpMap, def.roughnessMap, def.emissiveMap, def.normalMap, def.metalnessMap].filter((t): t is Texture => t !== undefined))];
}

export function createMaterialBank(t: Textures): MaterialBank {
  const b = new MaterialBank();
  const s = t.superficies;
  // estrutura da fase
  b.define('parede', { ...s.concreto, roughness: 0.95, bumpScale: 0.055 });
  // revestimento `azulejo` (ambiente.revestimento): esmalte um pouco mais liso que o concreto
  b.define('parede-azulejo', { ...s.azulejo, roughness: 0.4, metalness: 0.05, bumpScale: 0.025 });
  b.define('piso', { ...s.piso, roughness: 0.48, metalness: 0.16, bumpScale: 0.035 });
  b.define('teto', { ...s.teto, roughness: 0.9, bumpScale: 0.018 });
  b.define('degrau', { ...s.concreto, color: 0xbbb5a9, roughness: 0.9, bumpScale: .035 });
  b.define('vidro', { ...s.vidro, color: 0x8fb8c8, roughness: 0.08, metalness: 0.1, opacity: 0.22, ladoDuplo: true, bumpScale: .001 });
  b.define('grade', { ...s['metal-pintado'], color: 0x70777a, roughness: 0.45, metalness: 0.5, bumpScale: .008 });
  b.define('tubo', { ...s.aco, color: 0x8c9588, roughness: 0.5, metalness: 0.4, bumpScale: .008 });
  b.define('porta', { ...s.porta, roughness: 0.55, metalness: 0.3, bumpScale: .018 });
  b.define('comporta', { ...s.comporta, roughness: .45, metalness: .55, bumpScale: .022 });
  b.define('metal', { ...s['metal-pintado'], color: 0x7a8085, roughness: 0.5, metalness: 0.3, bumpScale: .008 });
  b.define('tela', { ...s.tela, emissiveMap: s.tela.map, color: 0x555e55, emissive: 0xb2ffcd, emissiveIntensity: 0.9 });
  b.define('papel', { ...s.papel, color: 0xffffff, emissive: 0xe8e4d6, emissiveMap: s.papel.map, emissiveIntensity: 0.12, roughness: 0.95, bumpScale: .001 });
  // Materiais dos props, compartilhados pelas duas fases. Cada peça mantém sua cor de vértice.
  for (const id of ['madeira', 'tecido', 'borracha', 'papel', 'aco', 'metal-pintado', 'vidro'] as const) {
    b.define(`prop-${id}`, { ...s[id], vertexColors: true, roughness: id === 'aco' ? .38 : .85, metalness: id === 'aco' ? .65 : id === 'metal-pintado' ? .3 : 0, bumpScale: id === 'tecido' ? .012 : .006 });
  }
  b.define('vazio', { color: 0x050505, roughness: 1 });
  // viewmodels das armas: um pouco emissivos para não sumirem no escuro
  b.define('arma', { ...s['metal-pintado'], color: 0x555b61, emissive: 0x2a2c30, emissiveIntensity: 0.25, roughness: 0.45, metalness: 0.3, bumpScale: .001 });
  b.define('arma-detalhe', { ...s.aco, color: 0x969fa6, emissive: 0x55595f, emissiveIntensity: 0.2, roughness: 0.35, metalness: 0.5, bumpScale: .001 });
  b.define('arma-cabo', { ...s.borracha, color: 0x554c43, emissive: 0x2e2620, emissiveIntensity: 0.12, roughness: 0.85, bumpScale: .002 });
  b.define('arma-capsula', { ...s.capsula, color: 0x4fb07a, emissive: 0x4fb07a, emissiveIntensity: 0.45, roughness: 0.4, bumpScale: .002 });
  b.define('arma-mira', { color: 0xff5a2a, emissive: 0xff5a2a, emissiveIntensity: 1.2 });
  COR_NIVEL.forEach((cor, nivel) => b.define(`nivel-${nivel}`, { ...s.cartao, color: cor, emissive: cor, emissiveMap: s.cartao.map, emissiveIntensity: 0.35, bumpScale: .0005 }));
  // pickups: um pouco emissivos para serem achados no escuro
  b.define('pk-vida', { ...s.vida, color: 0xffffff, emissive: 0xc7e6c9, emissiveMap: s.vida.map, emissiveIntensity: 0.3, bumpScale: .001 });
  b.define('pk-colete', { ...s.colete, color: 0xb0d4ff, emissive: 0x709fdd, emissiveMap: s.colete.map, emissiveIntensity: 0.25, bumpScale: .004 });
  for (const [tipo, cor] of [['balas', 0xc8a040], ['cartuchos', 0xc03a2a], ['leves', 0x8a9a3a]] as const) {
    b.define(`pk-${tipo}`, { ...s.municao, color: cor, emissive: cor, emissiveMap: s.municao.map, emissiveIntensity: .25, bumpScale: .001 });
  }
  b.define('pk-capsulas', { ...s.capsula, color: 0x40a0a0, emissive: 0x40a0a0, emissiveIntensity: 0.3, bumpScale: .002 });
  b.define('pk-arma', { ...s['metal-pintado'], color: 0x8c9299, emissive: 0x6a7080, emissiveIntensity: 0.3, metalness: 0.4, roughness: 0.4, bumpScale: .002 });
  // inimigos
  // as cores de cada peça vão no atributo `color` das geometrias unidas (view/inimigosModelos.ts)
  b.define('ini-corpo', { color: 0xffffff, roughness: 0.85, vertexColors: true });
  b.define('ini-olho', { color: 0xd8e6b0, emissive: 0xd8e6b0, emissiveIntensity: 0.7 });
  b.define('ini-visor', { color: 0xff7a3a, emissive: 0xff6a2a, emissiveIntensity: 0.8 });
  b.define('ini-dor', { color: 0xffffff, emissive: 0xffe0d0, emissiveIntensity: 1.6 });
  return b;
}
