import { Box3, Group, Vector3, type Mesh, type Object3D } from 'three';
import type { Recursos } from './recursos';

export const SLOT_FECHADURA = { bloqueada: 'fechadura-n1-bloqueada', liberada: 'fechadura-n1-liberada' } as const;
export const SLOT_FECHADURA_N2 = { bloqueada: 'fechadura-n2-bloqueada', liberada: 'fechadura-n2-liberada' } as const;
export const SLOT_FECHADURA_N3 = { bloqueada: 'fechadura-n3-bloqueada', liberada: 'fechadura-n3-liberada' } as const;
export interface VistaFechadura { grupo: Group; definirLiberada(liberada: boolean): void }
export interface ModelosFechadura { criarVista(rec: Recursos, nivel?: 1 | 2 | 3): VistaFechadura }

/** Frente do GLB = +Z. Centraliza a placa sem alterar a malha compartilhada. */
export function normalizarFechadura(modelo: Object3D): Group {
  const copia = modelo.clone(true), caixa = new Box3().setFromObject(copia);
  const grupo = new Group(), centro = caixa.getCenter(new Vector3());
  const conteudo = new Group(); conteudo.add(copia); conteudo.position.copy(centro).negate();
  grupo.add(conteudo); grupo.scale.setScalar(.42 / Math.max(.001, caixa.getSize(new Vector3()).y));
  return grupo;
}

/** Troca só o material do mesmo objeto; o banco continua controlando filtros e texturas. */
export function criarVistaFechadura(modelo: Object3D, rec: Recursos, nivel: 1 | 2 | 3 = 1): VistaFechadura {
  const slots = nivel === 3 ? SLOT_FECHADURA_N3 : nivel === 2 ? SLOT_FECHADURA_N2 : SLOT_FECHADURA;
  const grupo = new Group(); grupo.name = `fechadura:nivel-${nivel}`; grupo.add(modelo.clone(true));
  const malhas: Mesh[] = [];
  grupo.traverse(o => { const m = o as Mesh; if (m.isMesh) { malhas.push(m); m.castShadow = true; m.receiveShadow = true; } });
  let atual: boolean | null = null;
  const definirLiberada = (liberada: boolean) => {
    if (atual === liberada) return;
    atual = liberada;
    for (const m of malhas) {
      rec.soltarMalha(m);
      rec.usar(m, liberada ? slots.liberada : slots.bloqueada, true);
    }
  };
  definirLiberada(false);
  return { grupo, definirLiberada };
}
