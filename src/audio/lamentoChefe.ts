// Laços posicionais: um laço (`Laco`) tocando num ponto da fase, com oclusão suave. Usado pelo
// lamento do chefe inerte (guia o jogador até ele e cria tensão; toca na posição dada por
// `lamentoDoChefe`) e pelos laços dos perigos de área (zumbido da UV, jato de vapor).
// Cadeia: laço → passa-baixa (oclusão) → ganho (oclusão) → panner → barramento.
import { criarCadeiaPosicional } from './posicional';
import { POSICIONAL } from './regras';
import { lamentoInerte } from './sinteseChefe';
import { RAMPA_PARAR, type Bancada, type Laco } from './sintese';

/** corte do passa-baixa sem oclusão */
const ABERTO = 16000;
/** constante de tempo (s) da troca de oclusão: sem degrau */
const SUAVE = 0.12;

export type FabricaLaco = (b: Bancada, destino: AudioNode) => Laco;

export class LacoPosicional {
  private readonly laco: Laco;
  private readonly filtro: BiquadFilterNode;
  private readonly ganho: GainNode;
  private readonly panner: PannerNode;
  private abafado: boolean | null = null;
  private parado = false;

  constructor(private readonly b: Bancada, destino: AudioNode, x: number, y: number, z: number, fabrica: FabricaLaco) {
    const ctx = b.ctx;
    const cadeia = criarCadeiaPosicional(ctx, x, y, z, true);
    // a cadeia ocluída é [filtro, ganho, panner]; começa aberta e é ajustada por `abafar`
    this.filtro = cadeia[0] as BiquadFilterNode;
    this.ganho = cadeia[1] as GainNode;
    this.panner = cadeia[2] as PannerNode;
    this.filtro.frequency.value = ABERTO;
    this.ganho.gain.value = 1;
    this.panner.connect(destino);
    this.laco = fabrica(b, this.filtro);
  }

  /** Atrás de parede ou porta fechada: abafado (rampa curta). */
  abafar(abafado: boolean): void {
    if (this.parado || abafado === this.abafado) return;
    this.abafado = abafado;
    const t = this.b.ctx.currentTime;
    this.filtro.frequency.setTargetAtTime(abafado ? POSICIONAL.corteOclusao : ABERTO, t, SUAVE);
    this.ganho.gain.setTargetAtTime(abafado ? POSICIONAL.ganhoOclusao : 1, t, SUAVE);
  }

  mover(x: number, y: number, z: number): void {
    const p = this.panner;
    if (p.positionX) {
      if (p.positionX.value === x && p.positionY.value === y && p.positionZ.value === z) return;
      p.positionX.value = x;
      p.positionY.value = y;
      p.positionZ.value = z;
    } else {
      p.setPosition(x, y, z);
    }
  }

  /** Para com uma rampa de `rampa` s (padrão: a do laço). */
  parar(rampa = RAMPA_PARAR): void {
    if (this.parado) return;
    this.parado = true;
    const ctx = this.b.ctx;
    this.laco.parar(ctx.state === 'closed' ? 0 : ctx.currentTime, rampa);
    // o laço solta a própria saída; a cadeia sai do barramento depois da rampa
    setTimeout(() => {
      for (const n of [this.filtro, this.ganho, this.panner]) {
        try {
          n.disconnect();
        } catch {
          /* já desligado */
        }
      }
    }, 300 + rampa * 1000);
  }
}

/** Lamento do chefe inerte (096), posicional. */
export class LamentoChefe extends LacoPosicional {
  constructor(b: Bancada, destino: AudioNode, x: number, y: number, z: number) {
    super(b, destino, x, y, z, lamentoInerte);
  }
}
