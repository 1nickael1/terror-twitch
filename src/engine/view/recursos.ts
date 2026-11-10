// Registro do que uma view criou (geometrias, materiais, texturas, slots do banco, malhas do banco,
// instâncias e luzes), para descartar tudo de uma vez (nada da fase sobrevive ao dispose).
import { InstancedMesh, Light, type BufferGeometry, type Material, type Mesh, type Object3D, type Texture } from 'three';
import type { MaterialBank, SlotDef } from '../materials';

export class Recursos {
  private readonly geometrias = new Set<BufferGeometry>();
  private readonly materiais = new Set<Material>();
  private readonly doBanco = new Set<Mesh>();
  private readonly objetos = new Set<Object3D>();
  private readonly texturas = new Set<Texture>();
  private readonly slots = new Set<string>();

  constructor(private readonly bank: MaterialBank) {}

  geo<T extends BufferGeometry>(g: T): T {
    this.geometrias.add(g);
    return g;
  }

  mat<T extends Material>(m: T): T {
    this.materiais.add(m);
    return m;
  }

  tex<T extends Texture>(t: T): T {
    this.texturas.add(t);
    return t;
  }

  /** Slot do banco que vive só enquanto a fase (removido do banco no `dispose`). */
  slot(nome: string, def: SlotDef): string {
    this.bank.define(nome, def);
    this.slots.add(nome);
    return nome;
  }

  /** Brilho variável de um slot do banco (lâmpadas: segue o emissivo do filtro). */
  brilho(slot: string, k: number): void {
    this.bank.ajustarBrilho(slot, k);
  }

  /** Malha com material do banco (troca lambert/standard junto com o resto). */
  usar<T extends Mesh>(mesh: T, slot: string, geometriaCompartilhada = false): T {
    if (!geometriaCompartilhada) this.geometrias.add(mesh.geometry);
    this.doBanco.add(mesh);
    if (mesh instanceof InstancedMesh) this.objetos.add(mesh);
    return this.bank.use(mesh, slot);
  }

  /** Objetos com recursos próprios além da geometria (InstancedMesh, luzes). */
  obj<T extends Object3D>(o: T): T {
    this.objetos.add(o);
    return o;
  }

  /**
   * Esquece uma malha do banco (views que removem malhas no caminho). A geometria continua
   * registrada: pode ser compartilhada e é liberada no `dispose`.
   */
  soltarMalha(mesh: Mesh): void {
    this.bank.soltar(mesh);
    this.doBanco.delete(mesh);
  }

  dispose(): void {
    for (const m of this.doBanco) this.bank.soltar(m);
    for (const o of this.objetos) {
      if (o instanceof InstancedMesh || o instanceof Light) o.dispose();
    }
    for (const g of this.geometrias) g.dispose();
    for (const m of this.materiais) m.dispose();
    for (const s of this.slots) this.bank.removerSlot(s);
    for (const t of this.texturas) t.dispose();
    this.doBanco.clear();
    this.slots.clear();
    this.texturas.clear();
    this.objetos.clear();
    this.geometrias.clear();
    this.materiais.clear();
  }
}
