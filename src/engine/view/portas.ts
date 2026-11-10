// Portas: uma folha por porta que sobe conforme `abertura`, faixa na cor do cartão exigido,
// indicador de tranca (vermelho trancada, verde livre) e batente fixo (unido à malha estática).
// Folhas, faixas (uma malha por nível de cartão) e indicadores são InstancedMesh: poucas draw calls
// qualquer que seja o número de portas.
import { BoxGeometry, Color, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, Vector3, type Group } from 'three';
import { celula, centro } from '../../sim/grid';
import type { World } from '../../sim/world';
import { eixoAndavel } from './faseMesh';
import type { Coletor } from './geometria';
import type { Recursos } from './recursos';

const LARGURA_FOLHA = 1.9;
const ESPESSURA_FOLHA = 0.2;
/** a folha não some inteira no teto: sobra um palmo visível sob a verga */
const SUBIDA = 0.97;
const ALTURA_FAIXA = 0.22;
const Y_FAIXA = 1.15;
const VERDE = new Color(0x30ff60);
const VERMELHO = new Color(0xff2020);

interface VistaPorta {
  base: number; altura: number; cx: number; cz: number;
  /** escala da folha (caixa unitária) e da faixa */
  escFolha: Vector3; escFaixa: Vector3;
  /** malha e índice da faixa (por nível de cartão) */
  faixa: { malha: InstancedMesh; i: number };
}

export class PortasView {
  private readonly vistas: VistaPorta[] = [];
  private readonly folhas: InstancedMesh | null = null;
  private readonly faixas: InstancedMesh[] = [];
  private readonly indicadores: InstancedMesh | null = null;
  private readonly m = new Matrix4();
  private readonly pos = new Vector3();
  private readonly rot = new Quaternion();

  constructor(world: World, rec: Recursos, co: Coletor, grupo: Group) {
    const n = world.portas.length;
    if (n === 0) return;
    const unitaria = rec.geo(new BoxGeometry(1, 1, 1));

    this.folhas = rec.usar(new InstancedMesh(unitaria, undefined, n), 'porta');
    this.folhas.name = 'portas:folhas';
    // uma malha de faixa por nível (slots `nivel-0` a `nivel-3`), com as portas daquele nível
    const porNivel = new Map<number, number>();
    for (const p of world.portas) porNivel.set(p.exige ?? 0, (porNivel.get(p.exige ?? 0) ?? 0) + 1);
    const faixaDe = new Map<number, InstancedMesh>();
    for (const [nivel, qtd] of porNivel) {
      const malha = rec.usar(new InstancedMesh(unitaria, undefined, qtd), `nivel-${nivel}`);
      malha.name = `portas:faixa-${nivel}`;
      malha.count = 0;
      faixaDe.set(nivel, malha);
      this.faixas.push(malha);
    }
    for (const malha of [this.folhas, ...this.faixas]) {
      malha.castShadow = true;
      malha.receiveShadow = true;
      // as matrizes mudam a cada quadro: a esfera de todas as portas não serve para recorte
      malha.frustumCulled = false;
      grupo.add(malha);
    }

    const ind = rec.obj(new InstancedMesh(rec.geo(new BoxGeometry(0.1, 0.1, 0.1)), rec.mat(new MeshBasicMaterial({ color: 0xffffff })), n * 2));
    ind.name = 'portas:indicadores';

    world.portas.forEach((p, k) => {
      const [col, row] = p.coord;
      const c = celula(world.grid, col, row);
      const altura = c.teto - c.piso;
      const { x: cx, z: cz } = centro(p.coord);
      // corredor em x: a folha fica no plano yz (fina em x)
      const emX = eixoAndavel(world.grid, col, row) === 'x';
      const caixa = (ao: number, prof: number, alt: number) =>
        emX ? new BoxGeometry(prof, alt, ao) : new BoxGeometry(ao, alt, prof);
      const escala = (ao: number, prof: number, alt: number) => (emX ? new Vector3(prof, alt, ao) : new Vector3(ao, alt, prof));

      const malhaFaixa = faixaDe.get(p.exige ?? 0)!;
      const vista: VistaPorta = {
        base: c.piso + altura / 2, altura, cx, cz,
        escFolha: escala(LARGURA_FOLHA, ESPESSURA_FOLHA, altura),
        escFaixa: escala(LARGURA_FOLHA, ESPESSURA_FOLHA + 0.02, ALTURA_FAIXA),
        faixa: { malha: malhaFaixa, i: malhaFaixa.count++ },
      };
      this.vistas.push(vista);

      // batente: dois montantes e a verga, fixos
      for (const lado of [-1, 1]) {
        const montante = caixa(0.08, 0.34, altura);
        montante.translate(emX ? cx : cx + lado * 0.96, c.piso + altura / 2, emX ? cz + lado * 0.96 : cz);
        co.add('metal', montante);
      }
      const verga = caixa(2, 0.34, 0.16);
      verga.translate(cx, c.teto - 0.08, cz);
      co.add('metal', verga);

      // indicador nos dois lados da porta, junto ao montante, saltado da face
      [-1, 1].forEach((face, j) => {
        const fora = face * 0.2;
        this.m.makeTranslation(emX ? cx + fora : cx + 0.96, c.piso + 1.45, emX ? cz + 0.96 : cz + fora);
        ind.setMatrixAt(k * 2 + j, this.m);
        ind.setColorAt(k * 2 + j, VERMELHO);
      });
    });
    ind.computeBoundingSphere();
    grupo.add(ind);
    this.indicadores = ind;
    this.sincronizar(world);
  }

  /** Casa por índice: as portas da fase têm ordem estável (inclusive depois do checkpoint). */
  sincronizar(world: World): void {
    if (!this.folhas || !this.indicadores) return;
    world.portas.forEach((p, k) => {
      const v = this.vistas[k];
      if (!v) return;
      const y = v.base + p.abertura * v.altura * SUBIDA;
      this.folhas!.setMatrixAt(k, this.m.compose(this.pos.set(v.cx, y, v.cz), this.rot, v.escFolha));
      const yFaixa = y + Y_FAIXA - v.altura / 2;
      v.faixa.malha.setMatrixAt(v.faixa.i, this.m.compose(this.pos.set(v.cx, yFaixa, v.cz), this.rot, v.escFaixa));
      const cor = p.estado === 'trancada' ? VERMELHO : VERDE;
      this.indicadores!.setColorAt(k * 2, cor);
      this.indicadores!.setColorAt(k * 2 + 1, cor);
    });
    this.folhas.instanceMatrix.needsUpdate = true;
    for (const f of this.faixas) f.instanceMatrix.needsUpdate = true;
    if (this.indicadores.instanceColor) this.indicadores.instanceColor.needsUpdate = true;
  }
}
