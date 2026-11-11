// Modelos das armas em primeira pessoa: formas originais, de primitivas, em metros "de mão"
// (o suporte na câmera escala tudo para caber perto do olho). Frente = -z; a origem é a empunhadura.
import { BoxGeometry, CylinderGeometry, Group, Mesh, Object3D, SphereGeometry, type BufferGeometry } from 'three';
import type { ArmaId } from '../../sim/fase';
import type { Recursos } from './recursos';

export interface ModeloArma {
  grupo: Group;
  /** ponto do cano (onde nasce o clarão) */
  cano: Object3D;
  /** peça que gira a cada tiro (tambor do lançador) */
  tambor: Object3D | null;
}

type V3 = readonly [number, number, number];

/** Cilindro deitado ao longo de z. */
function tubo(r: number, comp: number, segmentos = 12): BufferGeometry {
  return new CylinderGeometry(r, r, comp, segmentos).rotateX(Math.PI / 2);
}

class Montador {
  readonly grupo = new Group();
  constructor(private readonly rec: Recursos) {}

  peca(geo: BufferGeometry, slot: string, pos: V3, rotX = 0, pai: Object3D = this.grupo): Mesh {
    const m = this.rec.usar(new Mesh(this.rec.geo(geo)), slot);
    m.position.set(...pos);
    m.rotation.x = rotX;
    pai.add(m);
    return m;
  }

  ponto(pos: V3): Object3D {
    const o = new Object3D();
    o.position.set(...pos);
    this.grupo.add(o);
    return o;
  }
}

/** Pistola compacta: ferrolho curto, empunhadura inclinada, mira acesa. */
function pistola(rec: Recursos): ModeloArma {
  const m = new Montador(rec);
  m.peca(new BoxGeometry(0.044, 0.048, 0.2), 'arma', [0, 0.035, -0.08]);
  m.peca(new BoxGeometry(0.04, 0.03, 0.15), 'arma-detalhe', [0, 0.0, -0.06]);
  m.peca(new BoxGeometry(0.04, 0.115, 0.055), 'arma-cabo', [0, -0.05, 0.012], 0.28);
  m.peca(new BoxGeometry(0.012, 0.03, 0.05), 'arma-detalhe', [0, -0.025, -0.045]);
  m.peca(tubo(0.011, 0.02, 8), 'arma-detalhe', [0, 0.035, -0.185]);
  m.peca(new BoxGeometry(0.008, 0.012, 0.01), 'arma-mira', [0, 0.065, -0.17]);
  m.peca(new BoxGeometry(0.03, 0.012, 0.01), 'arma-detalhe', [0, 0.065, 0.005]);
  return { grupo: m.grupo, cano: m.ponto([0, 0.035, -0.2]), tambor: null };
}

/** Escopeta: cano largo e curto, guarda-mão de bomba e coronha caída. */
function escopeta(rec: Recursos): ModeloArma {
  const m = new Montador(rec);
  m.peca(tubo(0.034, 0.3, 14), 'arma', [0, 0.035, -0.23]);
  m.peca(tubo(0.039, 0.025, 14), 'arma-detalhe', [0, 0.035, -0.37]);
  m.peca(tubo(0.03, 0.15, 10), 'arma-cabo', [0, -0.025, -0.2]);
  m.peca(new BoxGeometry(0.066, 0.08, 0.17), 'arma', [0, 0.01, -0.02]);
  m.peca(new BoxGeometry(0.05, 0.085, 0.2), 'arma-cabo', [0, -0.045, 0.15], -0.18);
  m.peca(new BoxGeometry(0.04, 0.09, 0.05), 'arma-cabo', [0, -0.07, 0.04], 0.3);
  m.peca(new BoxGeometry(0.01, 0.014, 0.012), 'arma-mira', [0, 0.075, -0.36]);
  return { grupo: m.grupo, cano: m.ponto([0, 0.035, -0.39]), tambor: null };
}

/** Submetralhadora: corpo reto, cano fino, carregador vertical longo, coronha de arame. */
function smg(rec: Recursos): ModeloArma {
  const m = new Montador(rec);
  m.peca(new BoxGeometry(0.05, 0.07, 0.24), 'arma', [0, 0.02, -0.06]);
  m.peca(tubo(0.011, 0.15, 8), 'arma-detalhe', [0, 0.03, -0.25]);
  m.peca(tubo(0.018, 0.04, 8), 'arma', [0, 0.03, -0.31]);
  m.peca(new BoxGeometry(0.03, 0.17, 0.045), 'arma-detalhe', [0, -0.1, -0.1], -0.08);
  m.peca(new BoxGeometry(0.036, 0.1, 0.045), 'arma-cabo', [0, -0.06, 0.03], 0.3);
  m.peca(new BoxGeometry(0.02, 0.012, 0.18), 'arma-detalhe', [0, 0.062, -0.07]);
  m.peca(new BoxGeometry(0.008, 0.012, 0.16), 'arma-detalhe', [-0.02, 0.0, 0.14]);
  m.peca(new BoxGeometry(0.008, 0.012, 0.16), 'arma-detalhe', [0.02, 0.0, 0.14]);
  m.peca(new BoxGeometry(0.008, 0.012, 0.01), 'arma-mira', [0, 0.074, -0.15]);
  return { grupo: m.grupo, cano: m.ponto([0, 0.03, -0.33]), tambor: null };
}

/** Lançador: tubo grosso por cima e um tambor de seis cápsulas que gira a cada disparo. */
function lancador(rec: Recursos): ModeloArma {
  const m = new Montador(rec);
  m.peca(tubo(0.05, 0.4, 14), 'arma', [0, 0.05, -0.17]);
  m.peca(tubo(0.058, 0.03, 14), 'arma-detalhe', [0, 0.05, -0.36]);
  m.peca(new BoxGeometry(0.04, 0.11, 0.05), 'arma-cabo', [0, -0.08, 0.04], 0.3);
  m.peca(new BoxGeometry(0.03, 0.08, 0.04), 'arma-cabo', [0, -0.06, -0.2], 0.1);
  const tambor = new Group();
  tambor.position.set(0, -0.025, -0.06);
  m.grupo.add(tambor);
  m.peca(tubo(0.065, 0.11, 6), 'arma-detalhe', [0, 0, 0], 0, tambor);
  const capsula = new SphereGeometry(0.017, 8, 6); // uma geometria para as seis cápsulas
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    m.peca(capsula, 'arma-capsula', [Math.cos(a) * 0.042, Math.sin(a) * 0.042, -0.056], 0, tambor);
  }
  m.peca(new BoxGeometry(0.012, 0.016, 0.012), 'arma-mira', [0, 0.105, -0.3]);
  return { grupo: m.grupo, cano: m.ponto([0, 0.05, -0.38]), tambor };
}

function armaImportada(rec: Recursos, modelo: Object3D, nome: string, slot: string, ponto: V3, id: string): ModeloArma {
  const grupo = new Group(); grupo.name = nome;
  const copia = modelo.clone(true);
  copia.traverse(o => { const m = o as Mesh; if (m.isMesh) { rec.usar(m, slot, true); m.frustumCulled = false; } });
  grupo.add(copia);
  const cano = new Object3D(); cano.name = `${id}:cano`; cano.position.set(...ponto); grupo.add(cano);
  return { grupo, cano, tambor: null };
}

export function construirArmas(rec: Recursos, novaPistola?: Object3D, novaEscopeta?: Object3D, novaSMG?: Object3D, novoLancador?: Object3D): Record<ArmaId, ModeloArma> {
  return {
    pistola: novaPistola ? armaImportada(rec, novaPistola, 'arma:pistola-neon-warden', 'pistola-neon', [0, .096, -.232], 'pistola') : pistola(rec),
    escopeta: novaEscopeta ? armaImportada(rec, novaEscopeta, 'arma:escopeta-worn-tactical', 'escopeta-tactical', [0, .047, -.428], 'escopeta') : escopeta(rec),
    smg: novaSMG ? armaImportada(rec, novaSMG, 'arma:smg-rusted-sentinel', 'smg-sentinel', [0, .070, -.321], 'smg') : smg(rec),
    lancador: novoLancador ? armaImportada(rec, novoLancador, 'arma:lancador-iron-viper', 'lancador-viper', [0, .070, -.427], 'lancador') : lancador(rec),
  };
}
