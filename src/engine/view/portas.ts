// Portas: folha deslizante com número de acesso pintado nas duas faces,
// batente da largura do leitor e fechadura fixa; malhas repetidas são instanciadas.
import { BoxGeometry, Color, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, Vector3, type Group } from 'three';
import { geometriaNumeroPorta } from './numerosPorta';
import { celula, centro } from '../../sim/grid';
import type { World } from '../../sim/world';
import { eixoAndavel } from './faseMesh';
import type { Coletor } from './geometria';
import type { Recursos } from './recursos';
import type { ModelosFechadura, VistaFechadura } from './fechadura';

const LARGURA_FOLHA = 1.9;
const ESPESSURA_FOLHA = 0.2;
/** a folha não some inteira no teto: sobra um palmo visível sob a verga */
const SUBIDA = 0.97;
const LARGURA_BATENTE = .285; // a mesma largura da fechadura normalizada para 42 cm
const CENTRO_BATENTE = 1 - LARGURA_BATENTE / 2;
const PROFUNDIDADE_BATENTE = .34;
const Y_NUMERO = 1.65;
const EIXO_Y = new Vector3(0, 1, 0);
const ESCALA_NUMERO = new Vector3(1, 1, 1);
const VERDE = new Color(0x30ff60);
const VERMELHO = new Color(0xff2020);

interface VistaPorta {
  base: number; altura: number; cx: number; cz: number;
  escFolha: Vector3; emX: boolean;
  numero?: { malha: InstancedMesh; i: number };
}

export class PortasView {
  private readonly vistas: VistaPorta[] = [];
  private readonly fechaduras = new Map<number, VistaFechadura[]>();
  private readonly folhas: InstancedMesh | null = null;
  private readonly numeros: InstancedMesh[] = [];
  private readonly indicadores: InstancedMesh | null = null;
  private readonly m = new Matrix4();
  private readonly pos = new Vector3();
  private readonly rot = new Quaternion();

  constructor(world: World, rec: Recursos, co: Coletor, grupo: Group, fechadura?: ModelosFechadura) {
    const n = world.portas.length;
    if (n === 0) return;
    const unitaria = rec.geo(new BoxGeometry(1, 1, 1));

    this.folhas = rec.usar(new InstancedMesh(unitaria, undefined, n), 'porta');
    this.folhas.name = 'portas:folhas';
    // O nível é um algarismo sem cartão, fundo ou faixa, nas duas faces da folha.
    const porNivel = new Map<number, number>();
    for (const p of world.portas) if (p.exige) porNivel.set(p.exige, (porNivel.get(p.exige) ?? 0) + 1);
    const numeroDe = new Map<number, InstancedMesh>();
    const slotNumero = rec.slot('porta:numero-acesso', { color: 0xe7e1cf, roughness: .9, emissive: 0xe7e1cf, emissiveIntensity: .08 });
    for (const [nivel, qtd] of porNivel) {
      const malha = rec.usar(new InstancedMesh(rec.geo(geometriaNumeroPorta(nivel)), undefined, qtd * 2), slotNumero);
      malha.name = `portas:numero-${nivel}`;
      malha.count = 0;
      numeroDe.set(nivel, malha);
      this.numeros.push(malha);
    }
    for (const malha of [this.folhas, ...this.numeros]) {
      malha.castShadow = true;
      malha.receiveShadow = true;
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

      const malhaNumero = p.exige ? numeroDe.get(p.exige) : undefined;
      const vista: VistaPorta = {
        base: c.piso + altura / 2, altura, cx, cz,
        escFolha: escala(LARGURA_FOLHA, ESPESSURA_FOLHA, altura),
        emX, numero: malhaNumero ? { malha: malhaNumero, i: malhaNumero.count } : undefined,
      };
      if (malhaNumero) malhaNumero.count += 2;
      this.vistas.push(vista);

      // batente: dois montantes e a verga, fixos
      for (const lado of [-1, 1]) {
        const montante = caixa(LARGURA_BATENTE, PROFUNDIDADE_BATENTE, altura);
        montante.translate(emX ? cx : cx + lado * CENTRO_BATENTE, c.piso + altura / 2, emX ? cz + lado * CENTRO_BATENTE : cz);
        co.add('metal', montante);
      }
      const verga = caixa(2, PROFUNDIDADE_BATENTE, LARGURA_BATENTE);
      verga.translate(cx, c.teto - LARGURA_BATENTE / 2, cz);
      co.add('metal', verga);

      // indicador nos dois lados da porta, junto ao montante, saltado da face
      [-1, 1].forEach((face, j) => {
        if (fechadura) {
          // Portas comuns também usam o leitor novo, já liberado se não estiverem trancadas.
          const vista = fechadura.criarVista(rec, p.exige ?? 1);
          vista.grupo.name = `fechadura:${p.id}:${face}`;
          vista.grupo.position.set(emX ? cx + face * .207 : cx + CENTRO_BATENTE, c.piso + 1.45, emX ? cz + CENTRO_BATENTE : cz + face * .207);
          vista.grupo.rotation.y = emX ? face * Math.PI / 2 : face === 1 ? 0 : Math.PI;
          grupo.add(vista.grupo);
          const faces = this.fechaduras.get(k) ?? []; faces.push(vista); this.fechaduras.set(k, faces);
          this.m.makeScale(0, 0, 0);
          ind.setMatrixAt(k * 2 + j, this.m);
          return;
        }
        const fora = face * 0.2;
        this.m.makeTranslation(emX ? cx + fora : cx + CENTRO_BATENTE, c.piso + 1.45, emX ? cz + CENTRO_BATENTE : cz + fora);
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
      this.rot.identity();
      this.folhas!.setMatrixAt(k, this.m.compose(this.pos.set(v.cx, y, v.cz), this.rot, v.escFolha));
      if (v.numero) for (const [j, face] of [-1, 1].entries()) {
        const fora = face * (ESPESSURA_FOLHA / 2 + .008);
        this.pos.set(v.emX ? v.cx + fora : v.cx, y + Y_NUMERO - v.altura / 2, v.emX ? v.cz : v.cz + fora);
        this.rot.setFromAxisAngle(EIXO_Y, v.emX ? face * Math.PI / 2 : face === 1 ? 0 : Math.PI);
        v.numero.malha.setMatrixAt(v.numero.i + j, this.m.compose(this.pos, this.rot, ESCALA_NUMERO));
      }
      const cor = p.estado === 'trancada' ? VERMELHO : VERDE;
      for (const f of this.fechaduras.get(k) ?? []) f.definirLiberada(p.estado !== 'trancada');
      this.indicadores!.setColorAt(k * 2, cor);
      this.indicadores!.setColorAt(k * 2 + 1, cor);
    });
    this.folhas.instanceMatrix.needsUpdate = true;
    for (const numero of this.numeros) numero.instanceMatrix.needsUpdate = true;
    if (this.indicadores.instanceColor) this.indicadores.instanceColor.needsUpdate = true;
  }
}
