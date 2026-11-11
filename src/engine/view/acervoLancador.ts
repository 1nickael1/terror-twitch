import { Box3, Group, Vector3, type Object3D } from 'three';
import type { CarregamentoAssets } from '../carregamentoAssets';
import type { MaterialBank } from '../materials';
import { AcervoArmaJogador } from './acervoArmaJogador';

/** Empunhadura junto ao gatilho; cano em -Z e tambor integrado à malha original. */
export function normalizarLancador(modelo: Object3D): Group {
  const raiz = new Group(); raiz.name = 'arma:lancador-iron-viper';
  const comprimento = new Box3().setFromObject(modelo).getSize(new Vector3()).x;
  const eixo = new Group(); eixo.rotation.y = -Math.PI / 2; eixo.scale.setScalar(.62 / Math.max(.001, comprimento));
  const copia = modelo.clone(true); copia.position.set(-.36, .13, .000541);
  eixo.add(copia); raiz.add(eixo); return raiz;
}
export class AcervoLancador extends AcervoArmaJogador {
  constructor(bank: MaterialBank, anisotropia: number, carregamento: CarregamentoAssets) {
    super({ id: 'lancador', slot: 'lancador-viper', nome: 'Lançador Iron Viper', normalizar: normalizarLancador }, bank, anisotropia, carregamento);
  }
}
