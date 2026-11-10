// Malha estática da fase a partir da grade 2.5D: pisos (com rampas), tetos, paredes, degraus,
// janelas, grades e tubos. Tudo o que é estático é unido por material no `Coletor`.
import { BoxGeometry, CylinderGeometry, InstancedMesh, Matrix4, Quaternion, Vector3, type Group } from 'three';
import { alturaPiso, celula, CELL, type Grid } from '../../sim/grid';
import { Coletor, faceVertical, quad } from './geometria';
import type { Recursos } from './recursos';

/** Janela: mureta até 1,0 m e vidro até 2,2 m acima do piso da célula da janela. */
export const MURETA = 1.0;
export const TOPO_VIDRO = 2.2;
const EPS = 1e-3;
const RAIO_BARRA = 0.025;
const PASSO_BARRA = 0.2;
const RAIO_TUBO = 0.18;
const PASSO_TUBO = 0.42;

/** Como a célula é desenhada: andável, vazada (grade/tubo entre áreas andáveis), janela ou sólida. */
export interface InfoCelula { modo: 'piso' | 'vazado' | 'janela' | 'solido'; piso: number; teto: number }

export const DIRECOES = [
  { dc: 0, dr: -1 }, { dc: 1, dr: 0 }, { dc: 0, dr: 1 }, { dc: -1, dr: 0 },
] as const;

export function infoCelula(g: Grid, col: number, row: number): InfoCelula {
  const c = celula(g, col, row);
  if (c.tipo === 'piso') return { modo: 'piso', piso: c.piso, teto: c.teto };
  if (c.tipo === 'janela') return { modo: 'janela', piso: c.piso, teto: c.teto };
  if (c.tipo === 'grade' || c.tipo === 'tubo') {
    const vizinhas = DIRECOES.map((d) => celula(g, col + d.dc, row + d.dr)).filter((v) => v.tipo === 'piso');
    if (vizinhas.length > 0) {
      return {
        modo: 'vazado',
        piso: Math.min(...vizinhas.map((v) => v.piso)),
        teto: Math.min(...vizinhas.map((v) => v.teto)),
      };
    }
  }
  return { modo: 'solido', piso: c.piso, teto: c.teto };
}

/**
 * Eixo entre as vizinhas andáveis: o que tem piso dos dois lados opostos (passagem); se nenhum
 * tem, 'x' quando há piso a leste ou oeste, senão 'z'.
 */
export function eixoAndavel(g: Grid, col: number, row: number): 'x' | 'z' {
  const andavel = (dc: number, dr: number) => celula(g, col + dc, row + dr).tipo === 'piso';
  const emX = andavel(1, 0) && andavel(-1, 0);
  const emZ = andavel(0, 1) && andavel(0, -1);
  if (emX !== emZ) return emX ? 'x' : 'z';
  return andavel(1, 0) || andavel(-1, 0) ? 'x' : 'z';
}

/** Pontas A→B da borda da célula na direção dada, com a normal (-dz, 0, dx) apontando para dentro dela. */
function borda(col: number, row: number, dc: number, dr: number) {
  const x0 = col * CELL;
  const z0 = row * CELL;
  const x1 = x0 + CELL;
  const z1 = z0 + CELL;
  if (dr === -1) return { a: { x: x0, z: z0 }, b: { x: x1, z: z0 } };
  if (dc === 1) return { a: { x: x1, z: z0 }, b: { x: x1, z: z1 } };
  if (dr === 1) return { a: { x: x1, z: z1 }, b: { x: x0, z: z1 } };
  return { a: { x: x0, z: z1 }, b: { x: x0, z: z0 } };
}

/** Altura do piso da célula num ponto da sua borda (o ponto é puxado para dentro dela). */
function pisoNaBorda(g: Grid, info: InfoCelula, col: number, row: number, p: { x: number; z: number }): number {
  if (info.modo !== 'piso') return info.piso;
  const x = Math.min((col + 1) * CELL - EPS, Math.max(col * CELL + EPS, p.x));
  const z = Math.min((row + 1) * CELL - EPS, Math.max(row * CELL + EPS, p.z));
  return alturaPiso(g, { x, z });
}

export interface Instancias { barras: Matrix4[]; tubos: Matrix4[] }

const Y = new Vector3(0, 1, 0);
const X = new Vector3(1, 0, 0);
const Z = new Vector3(0, 0, 1);

function matriz(pos: Vector3, rot: Quaternion, escala: Vector3): Matrix4 {
  return new Matrix4().compose(pos, rot, escala);
}

/** Piso, teto e bordas de uma célula andável ou vazada. */
function celulaAberta(g: Grid, col: number, row: number, info: InfoCelula, co: Coletor): void {
  const x0 = col * CELL;
  const z0 = row * CELL;
  const x1 = x0 + CELL;
  const z1 = z0 + CELL;
  const h = (x: number, z: number) => pisoNaBorda(g, info, col, row, { x, z });
  co.add('piso', quad(
    [[x0, h(x0, z0), z0], [x0, h(x0, z1), z1], [x1, h(x1, z1), z1], [x1, h(x1, z0), z0]],
    [[x0, -z0], [x0, -z1], [x1, -z1], [x1, -z0]],
  ));
  const t = info.teto;
  co.add('teto', quad([[x0, t, z0], [x1, t, z0], [x1, t, z1], [x0, t, z1]], [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]));

  for (const d of DIRECOES) {
    const nc = col + d.dc;
    const nr = row + d.dr;
    const viz = infoCelula(g, nc, nr);
    const { a, b } = borda(col, row, d.dc, d.dr);
    const a0 = h(a.x, a.z);
    const a1 = h(b.x, b.z);
    if (viz.modo === 'piso' || viz.modo === 'vazado') {
      // degrau: a vizinha é mais alta, a face olha para cá
      const b0 = Math.min(t, pisoNaBorda(g, viz, nc, nr, a));
      const b1 = Math.min(t, pisoNaBorda(g, viz, nc, nr, b));
      if (b0 > a0 + EPS || b1 > a1 + EPS) co.add('degrau', faceVertical(a, b, a0, a1, Math.max(a0, b0), Math.max(a1, b1)));
      // teto da vizinha mais baixo: a parede entre os dois tetos olha para cá
      if (viz.teto < t - EPS) {
        co.add('parede', faceVertical(a, b, Math.max(viz.teto, a0), Math.max(viz.teto, a1), t, t));
      }
    } else if (viz.modo === 'janela' && info.modo === 'piso') {
      // a célula da janela desenha as próprias faces
    } else {
      co.add('parede', faceVertical(a, b, a0, a1, t, t));
    }
  }
}

/**
 * Face vertical de uma célula de janela numa borda: `de`/`ate` são as alturas nas duas pontas
 * (A→B da borda; `paraFora` = a face olha para a vizinha, com as pontas invertidas na malha).
 */
export interface FaceJanela {
  dc: number; dr: number; tipo: 'mureta' | 'verga' | 'ombreira'; paraFora: boolean;
  de: [number, number]; ate: [number, number];
}

/**
 * Faces verticais de uma célula de janela. Para cada vizinha andável: a mureta, do piso da vizinha
 * (na borda) até o peitoril, e a verga, do topo do vidro até o teto da vizinha, ambas olhando para
 * ela; isso fecha o desnível quando a janela fica mais alta ou mais baixa que a vizinha. Vizinha
 * sólida: ombreira do vão, olhando para dentro. Vizinha janela: nada (o vão continua).
 */
export function facesJanela(g: Grid, col: number, row: number): FaceJanela[] {
  const info = infoCelula(g, col, row);
  const baixo = info.piso + MURETA;
  const alto = info.piso + TOPO_VIDRO;
  const faces: FaceJanela[] = [];
  for (const d of DIRECOES) {
    const nc = col + d.dc;
    const nr = row + d.dr;
    const viz = infoCelula(g, nc, nr);
    if (viz.modo === 'janela') continue; // janela larga: o vão continua na vizinha
    if (viz.modo !== 'piso') {
      faces.push({ dc: d.dc, dr: d.dr, tipo: 'ombreira', paraFora: false, de: [baixo, baixo], ate: [alto, alto] });
      continue;
    }
    // faces olhando para a vizinha andável (pontas B→A)
    const { a, b } = borda(col, row, d.dc, d.dr);
    const p0 = pisoNaBorda(g, viz, nc, nr, b);
    const p1 = pisoNaBorda(g, viz, nc, nr, a);
    if (p0 < baixo - EPS || p1 < baixo - EPS) {
      faces.push({ dc: d.dc, dr: d.dr, tipo: 'mureta', paraFora: true, de: [p0, p1], ate: [Math.max(p0, baixo), Math.max(p1, baixo)] });
    }
    if (viz.teto > alto + EPS) {
      faces.push({ dc: d.dc, dr: d.dr, tipo: 'verga', paraFora: true, de: [Math.max(p0, alto), Math.max(p1, alto)], ate: [viz.teto, viz.teto] });
    }
  }
  return faces;
}

/** Janela: mureta, vidro com moldura e parede acima; o vão atravessa a célula. */
function celulaJanela(g: Grid, col: number, row: number, info: InfoCelula, co: Coletor): void {
  const x0 = col * CELL;
  const z0 = row * CELL;
  const x1 = x0 + CELL;
  const z1 = z0 + CELL;
  const baixo = info.piso + MURETA;
  const alto = info.piso + TOPO_VIDRO;
  // peitoril e verga atravessando a célula
  co.add('parede', quad([[x0, baixo, z0], [x0, baixo, z1], [x1, baixo, z1], [x1, baixo, z0]], [[x0, -z0], [x0, -z1], [x1, -z1], [x1, -z0]]));
  co.add('parede', quad([[x0, alto, z0], [x1, alto, z0], [x1, alto, z1], [x0, alto, z1]], [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]));

  for (const f of facesJanela(g, col, row)) {
    const { a, b } = borda(col, row, f.dc, f.dr);
    // inverter A e B vira a normal para fora da célula
    co.add('parede', f.paraFora ? faceVertical(b, a, f.de[0], f.de[1], f.ate[0], f.ate[1]) : faceVertical(a, b, f.de[0], f.de[1], f.ate[0], f.ate[1]));
  }

  // vidro no meio da célula, perpendicular ao eixo entre as áreas andáveis, com moldura
  const cx = x0 + CELL / 2;
  const cz = z0 + CELL / 2;
  const eixo = eixoAndavel(g, col, row);
  const vidro = eixo === 'x'
    ? quad([[cx, baixo, z1], [cx, baixo, z0], [cx, alto, z0], [cx, alto, z1]], [[z1, baixo], [z0, baixo], [z0, alto], [z1, alto]])
    : quad([[x0, baixo, cz], [x1, baixo, cz], [x1, alto, cz], [x0, alto, cz]], [[x0, baixo], [x1, baixo], [x1, alto], [x0, alto]]);
  co.add('vidro', vidro);
  const altura = alto - baixo;
  const pecas: [larg: number, alt: number, ao: number, y: number][] = [
    // largura ao longo da janela, altura, centro ao longo da janela, centro em y
    [CELL, 0.06, 0, baixo + 0.03], [CELL, 0.06, 0, alto - 0.03],
    [0.06, altura, -CELL / 2 + 0.03, baixo + altura / 2], [0.06, altura, CELL / 2 - 0.03, baixo + altura / 2],
  ];
  for (const [larg, alt, ao, y] of pecas) {
    const box = eixo === 'x' ? new BoxGeometry(0.08, alt, larg) : new BoxGeometry(larg, alt, 0.08);
    box.translate(eixo === 'x' ? cx : cx + ao, y, eixo === 'x' ? cz + ao : cz);
    co.add('metal', box);
  }
}

/** Barras da grade, num plano no meio da célula, perpendicular ao eixo andável. */
function barrasGrade(g: Grid, col: number, row: number, info: InfoCelula, inst: Instancias, co: Coletor): void {
  const cx = col * CELL + CELL / 2;
  const cz = row * CELL + CELL / 2;
  const eixo = eixoAndavel(g, col, row);
  const altura = info.teto - info.piso;
  const n = Math.round(CELL / PASSO_BARRA);
  const rot = new Quaternion();
  const esc = new Vector3(1, altura, 1);
  for (let i = 0; i < n; i++) {
    const ao = -CELL / 2 + PASSO_BARRA * (i + 0.5);
    const pos = eixo === 'x' ? new Vector3(cx, info.piso + altura / 2, cz + ao) : new Vector3(cx + ao, info.piso + altura / 2, cz);
    inst.barras.push(matriz(pos, rot, esc));
  }
  for (const y of [info.piso + 0.15, info.piso + altura * 0.55]) {
    const box = eixo === 'x' ? new BoxGeometry(0.06, 0.06, CELL) : new BoxGeometry(CELL, 0.06, 0.06);
    box.translate(cx, y, cz);
    co.add('grade', box);
  }
}

/** Tubos horizontais empilhados em duas camadas, paralelos à face vista da área andável. */
function tubos(g: Grid, col: number, row: number, info: InfoCelula, inst: Instancias): void {
  const cx = col * CELL + CELL / 2;
  const cz = row * CELL + CELL / 2;
  // vista do norte ou do sul, os tubos correm em x; vista do leste ou oeste, em z
  const correX = eixoAndavel(g, col, row) === 'z';
  const rot = new Quaternion().setFromUnitVectors(Y, correX ? X : Z);
  const esc = new Vector3(1, 1, 1);
  const n = Math.max(1, Math.floor((info.teto - info.piso) / PASSO_TUBO));
  for (let i = 0; i < n; i++) {
    const y = info.piso + RAIO_TUBO + 0.02 + i * PASSO_TUBO;
    for (const camada of [-0.45, 0.35]) {
      const desloc = camada + (i % 2) * 0.1;
      const pos = correX ? new Vector3(cx, y, cz + desloc) : new Vector3(cx + desloc, y, cz);
      inst.tubos.push(matriz(pos, rot, esc));
    }
  }
}

/** Constrói a geometria estática da grade no coletor e devolve as instâncias de barras e tubos. */
export function construirFase(g: Grid, co: Coletor): Instancias {
  const inst: Instancias = { barras: [], tubos: [] };
  for (let row = 0; row < g.rows; row++) {
    for (let col = 0; col < g.cols; col++) {
      const info = infoCelula(g, col, row);
      if (info.modo === 'piso' || info.modo === 'vazado') celulaAberta(g, col, row, info, co);
      else if (info.modo === 'janela') celulaJanela(g, col, row, info, co);
      if (info.modo !== 'vazado') continue;
      const tipo = celula(g, col, row).tipo;
      if (tipo === 'grade') barrasGrade(g, col, row, info, inst, co);
      else tubos(g, col, row, info, inst);
    }
  }
  return inst;
}

/** InstancedMesh das barras de grade e dos tubos (vazios não criam nada). */
export function malhasInstanciadas(inst: Instancias, rec: Recursos, grupo: Group): void {
  const criar = (lista: Matrix4[], geo: () => CylinderGeometry, slot: string) => {
    if (lista.length === 0) return;
    const m = rec.usar(new InstancedMesh(rec.geo(geo()), undefined, lista.length), slot);
    lista.forEach((mat, i) => m.setMatrixAt(i, mat));
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = `fase:${slot}`;
    grupo.add(m);
  };
  criar(inst.barras, () => new CylinderGeometry(RAIO_BARRA, RAIO_BARRA, 1, 6), 'grade');
  criar(inst.tubos, () => new CylinderGeometry(RAIO_TUBO, RAIO_TUBO, CELL, 10), 'tubo');
}
