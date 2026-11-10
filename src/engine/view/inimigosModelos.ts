// Modelos dos inimigos: um esqueleto de grupos (pivôs nas juntas) com peças de primitivas. Os
// moldes ficam em `moldesInimigos.ts` (comuns, fases 1 e 2) e `moldeChefe.ts` (chefes 096 e 049).
// Desempenho: as peças rígidas de cada osso viram UMA geometria (cor de cada peça no atributo
// `color`, slot `ini-corpo` com `vertexColors`); as emissivas de um osso, outra. São no máximo 8
// malhas por inimigo, com geometrias criadas uma vez por tipo.
import { AdditiveBlending, Color, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, Vector3, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TIPOS } from '../../sim/ai/tipos';
import { ENTIDADE049, ENTIDADE096, SLOT_LENTE_049, SLOT_OLHO_CHEFE } from './moldeChefe';
import {
  CIRURGICO, ENFERMEIRO, FUNCIONARIO, GENERICO, REANIMADO, SEGURANCA,
  type Antebraco, type Molde, type Osso, type OssoBase, type Peca,
} from './moldesInimigos';
import type { Recursos } from './recursos';

export type { Osso, PoseBase } from './moldesInimigos';

export const MOLDES: Readonly<Record<string, Molde>> = {
  funcionario: FUNCIONARIO, seguranca: SEGURANCA, entidade096: ENTIDADE096,
  reanimado: REANIMADO, reanimado_cirurgico: CIRURGICO, enfermeiro: ENFERMEIRO, entidade049: ENTIDADE049,
};

/** cor padrão do brilho do preparo (boca da arma do segurança) */
const COR_BRILHO = 0xff7a30;

/** Sombra só de tronco e pernas (braços e cabeça quase não mudam a sombra). */
const OSSOS_COM_SOMBRA: ReadonlySet<Osso> = new Set<Osso>(['tronco', 'pernaE', 'pernaD']);
const OSSOS_BASE: readonly OssoBase[] = ['tronco', 'cabeca', 'bracoE', 'bracoD', 'pernaE', 'pernaD'];
const ANTEBRACOS: readonly Antebraco[] = ['antebracoE', 'antebracoD'];
const OSSOS: readonly Osso[] = [...OSSOS_BASE, ...ANTEBRACOS];

export interface MalhaRig {
  malha: Mesh; slot: string;
  emissivo: boolean;   // não pisca na dor
  sombra: boolean;     // projeta sombra enquanto vivo
  apaga: boolean;      // some quando o corpo termina de cair
  brilho: boolean;     // boca da arma: escala com o preparo
}

export interface Rig {
  raiz: Group;     // posição nos pés e yaw
  corpo: Group;    // queda, solavanco e escala do tipo (pivô nos pés)
  pelve: Group;    // altura do quadril
  /** antebraços só nos moldes que têm cotovelo (filhos do braço) */
  ossos: Record<OssoBase, Group> & Partial<Record<Antebraco, Group>>;
  base: Molde['base'];
  malhas: MalhaRig[];
}

/** Malha unida de um tipo: criada uma vez, compartilhada por todos os inimigos do tipo. */
interface MalhaTipo {
  osso: Osso; geo: BufferGeometry; slot: string; emissivo: boolean; apaga: boolean;
  brilho: Vector3 | null;   // posição da boca (a geometria do brilho fica centrada)
  corBrilho: number;
}

function moldar(p: Peca): BufferGeometry {
  const g = p.geo();
  // girar, esticar e só então posicionar (o brilho fica centrado; a posição vai na malha)
  if (p.rot) g.rotateX(p.rot[0]).rotateY(p.rot[1]).rotateZ(p.rot[2]);
  if (p.esc) g.scale(...p.esc);
  if (p.pos && !p.brilho) g.translate(...p.pos);
  return g;
}

/** Une as geometrias (descarta as partes). */
export function unir(partes: BufferGeometry[]): BufferGeometry {
  const g = mergeGeometries(partes, false);
  for (const p of partes) p.dispose();
  if (!g) throw new Error('Falha ao unir as peças');
  return g;
}

/** Grava a cor da peça (convertida para o espaço linear) no atributo `color`. */
export function pintar(g: BufferGeometry, hex: number): BufferGeometry {
  const c = new Color().setHex(hex);
  const n = g.getAttribute('position').count;
  const cores = new Float32Array(n * 3);
  const pos = g.getAttribute('position');
  const normal = g.getAttribute('normal');
  for (let i = 0; i < n; i++) {
    // Pigmentação irregular e oclusão suave nas faces voltadas para baixo.
    // Calculado uma vez ao montar o molde, sem textura ou draw call adicional.
    const mancha = Math.sin(pos.getX(i) * 73 + pos.getY(i) * 41 + pos.getZ(i) * 59);
    const k = .91 + .055 * mancha + .035 * (normal?.getY(i) ?? 0);
    cores[i * 3] = c.r * k;
    cores[i * 3 + 1] = c.g * k;
    cores[i * 3 + 2] = c.b * k;
  }
  g.setAttribute('color', new Float32BufferAttribute(cores, 3));
  return g;
}

export class ModelosInimigos {
  private readonly tipos = new Map<string, MalhaTipo[]>();
  /** material aditivo de cada cor de brilho (criado na primeira vez) */
  private readonly matsBrilho = new Map<number, MeshBasicMaterial>();

  constructor(private readonly rec: Recursos) {
    // olhos do chefe 096: brilho frio e fraco; lentes da máscara do 049: brasa fraca (vivem com a fase)
    rec.slot(SLOT_OLHO_CHEFE, { color: 0xd4e4f4, emissive: 0xbcd6ff, emissiveIntensity: 0.45 });
    rec.slot(SLOT_LENTE_049, { color: 0x3a1a14, emissive: 0xd0522a, emissiveIntensity: 0.55 });
  }

  private matBrilho(cor: number): MeshBasicMaterial {
    let m = this.matsBrilho.get(cor);
    if (!m) {
      m = this.rec.mat(new MeshBasicMaterial({
        color: cor, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false,
      }));
      this.matsBrilho.set(cor, m);
    }
    return m;
  }

  montar(tipo: string): Rig {
    const conhecido = Object.prototype.hasOwnProperty.call(MOLDES, tipo);
    const molde = conhecido ? MOLDES[tipo] : GENERICO;
    const chave = conhecido ? tipo : '*';
    let malhasTipo = this.tipos.get(chave);
    if (!malhasTipo) {
      malhasTipo = this.unirMolde(molde);
      this.tipos.set(chave, malhasTipo);
    }

    const raiz = new Group();
    const corpo = new Group();
    const pelve = new Group();
    pelve.position.y = molde.base.quadril;
    const ossos = {} as Rig['ossos'];
    for (const nome of OSSOS_BASE) {
      const o = new Group();
      o.position.set(...molde.juntas[nome]);
      ossos[nome] = o;
    }
    pelve.add(ossos.tronco, ossos.pernaE, ossos.pernaD);
    ossos.tronco.add(ossos.cabeca, ossos.bracoE, ossos.bracoD);
    for (const nome of ANTEBRACOS) {
      const junta = molde.juntas[nome];
      if (!junta) continue;
      const o = new Group();
      o.position.set(...junta);
      ossos[nome] = o;
      (nome === 'antebracoE' ? ossos.bracoE : ossos.bracoD).add(o);
    }
    corpo.add(pelve);
    raiz.add(corpo);

    // a escala do tipo vai no corpo (os pivôs escalam junto)
    const t = Object.prototype.hasOwnProperty.call(TIPOS, tipo) ? TIPOS[tipo] : undefined;
    const largura = (t?.raio ?? 0.35) / 0.35;
    const altura = (t?.altura ?? 1.8) / 1.8;
    corpo.scale.set(largura, altura, largura);

    const malhas: MalhaRig[] = malhasTipo.map((m) => {
      let malha: Mesh;
      if (m.brilho) {
        malha = new Mesh(m.geo, this.matBrilho(m.corBrilho));
        malha.position.copy(m.brilho);
      } else {
        malha = this.rec.usar(new Mesh(m.geo), m.slot);
      }
      const sombra = !m.emissivo && OSSOS_COM_SOMBRA.has(m.osso);
      malha.castShadow = sombra;
      const osso = ossos[m.osso];
      if (!osso) throw new Error(`Molde "${tipo}" usa o osso "${m.osso}" sem junta`);
      osso.add(malha);
      return { malha, slot: m.slot, emissivo: m.emissivo, sombra, apaga: m.apaga, brilho: m.brilho !== null };
    });
    return { raiz, corpo, pelve, ossos, base: molde.base, malhas };
  }

  /** Une as peças do molde: por osso, uma geometria colorida e uma por grupo emissivo. */
  private unirMolde(molde: Molde): MalhaTipo[] {
    const saida: MalhaTipo[] = [];
    for (const osso of OSSOS) {
      const pecas = molde.pecas.filter((p) => p.osso === osso);
      const comuns = pecas.filter((p) => !p.emissivo);
      if (comuns.length > 0) {
        const geo = unir(comuns.map((p) => pintar(moldar(p), p.cor ?? 0xffffff)));
        saida.push({ osso, geo: this.rec.geo(geo), slot: 'ini-corpo', emissivo: false, apaga: false, brilho: null, corBrilho: 0 });
      }
      for (const p of pecas) {
        if (!p.brilho) continue;
        saida.push({
          osso, geo: this.rec.geo(moldar(p)), slot: '', emissivo: true, apaga: true,
          brilho: new Vector3(...(p.pos ?? [0, 0, 0])), corBrilho: p.corBrilho ?? COR_BRILHO,
        });
      }
      // emissivas comuns: uma malha por (slot, apaga) no osso
      const grupos = new Map<string, Peca[]>();
      for (const p of pecas) {
        if (!p.emissivo || p.brilho) continue;
        const k = `${p.slot ?? 'ini-olho'}|${p.apaga !== false}`;
        grupos.set(k, [...(grupos.get(k) ?? []), p]);
      }
      for (const [k, lista] of grupos) {
        const [slot, apaga] = k.split('|');
        saida.push({
          osso, geo: this.rec.geo(unir(lista.map(moldar))), slot, emissivo: true, apaga: apaga === 'true', brilho: null, corBrilho: 0,
        });
      }
    }
    return saida;
  }
}
