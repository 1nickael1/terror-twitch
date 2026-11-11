import { Box3, Group, Vector3, type Object3D } from 'three';
import type { CarregamentoAssets } from '../carregamentoAssets';
import type { MaterialBank } from '../materials';
import { AcervoArmaJogador } from './acervoArmaJogador';

/** Empunhadura junto ao gatilho, cano em -Z e coronha para trás do suporte FPS. */
export function normalizarEscopeta(modelo: Object3D): Group {
  const raiz = new Group(); raiz.name = 'arma:escopeta-worn-tactical';
  const comprimento = new Box3().setFromObject(modelo).getSize(new Vector3()).x;
  const eixo = new Group(); eixo.rotation.y = -Math.PI / 2; eixo.scale.setScalar(.64 / Math.max(.001, comprimento));
  const copia = modelo.clone(true); copia.position.set(-.32, .015, .0012285);
  eixo.add(copia); raiz.add(eixo); return raiz;
}
export class AcervoEscopeta extends AcervoArmaJogador {
  constructor(bank: MaterialBank, anisotropia: number, carregamento: CarregamentoAssets) {
    super({ id: 'escopeta', slot: 'escopeta-tactical', nome: 'Espingarda Worn Tactical', normalizar: normalizarEscopeta }, bank, anisotropia, carregamento);
  }
}
