import type { AnimationClip, Object3D } from 'three';
import { AcervoHumano } from './acervoHumano';
import { InstanciaChefePrevia } from './chefePrevia';
import type { MaterialBank } from '../materials';
import type { CarregamentoAssets } from '../carregamentoAssets';
import type { Recursos } from './recursos';
import type { EstadoChefe096, Inimigo } from '../../sim/world';
import { CHEFE_096 } from '../../sim/balance';

export class AcervoChefe extends AcervoHumano<InstanciaChefe> {
  constructor(bank: MaterialBank, anisotropia = 4, carregamento?: CarregamentoAssets) {
    super({ id: 'chefe1', bank, anisotropia, carregamento, preparar: clips => [...clips],
      instanciar: (modelo, clips, rec) => new InstanciaChefe(modelo, clips, rec) });
  }
}

export function animacaoDoChefe(fase: EstadoChefe096['fase'], golpe = false): string {
  if (fase === 'morto') return 'Strangled_and_Fall_Forward';
  if (fase === 'despertando' || fase === 'arrombando') return 'Skill_01';
  if (fase === 'procurando') return 'Walking_Scan_with_Sudden_Look_Back';
  if (golpe) return 'Right_Hand_Sword_Slash';
  if (fase === 'perseguicao' || fase === 'investida') return 'run_fast_2';
  return 'Walking';
}

/** Mesmo modelo da bancada, com movimentos selecionados pelos estados reais da IA. */
export class InstanciaChefe extends InstanciaChefePrevia {
  private nome = '';
  private fase = '';
  private golpe = 0;
  private despertarTotal = CHEFE_096.despertar as number;
  private primeiro = true;

  constructor(modelo: Object3D, clips: readonly AnimationClip[], rec: Recursos) {
    super(modelo, clips, rec); this.raiz.name = 'chefe-meshy';
  }

  atacar(): void { this.golpe = .6; this.nome = ''; }

  animar(i: Pick<Inimigo, 'modo'>, chefe: EstadoChefe096 | null, velocidade: number, dt: number): void {
    const fase = i.modo === 'morto' ? 'morto' : chefe?.fase ?? 'inerte';
    if (fase !== 'perseguicao') this.golpe = 0;
    if (fase === 'despertando' && this.fase !== fase) this.despertarTotal = Math.max(dt, chefe?.timer ?? CHEFE_096.despertar);
    const nome = animacaoDoChefe(fase, this.golpe > 0);
    const parado = fase === 'inerte' || fase === 'pausa' || (fase === 'investida' && (chefe?.timer ?? 0) > CHEFE_096.investidaMax);
    if (nome !== this.nome || fase !== this.fase) {
      this.selecionar(nome, fase !== 'morto' && fase !== 'despertando' && this.golpe <= 0, true);
      this.nome = nome;
    }
    const duracao = this.clips.find(c => c.name === nome)?.duration ?? 1;
    const taxa = fase === 'despertando' ? duracao / this.despertarTotal
      : this.golpe > 0 ? duracao / .6
      : fase === 'procurando' ? .8
      : fase === 'perseguicao' || fase === 'investida' ? Math.max(.65, Math.min(1.5, velocidade / CHEFE_096.velocidadePerseguicao)) : 1;
    this.atualizar(dt, taxa, parado, parado ? .25 : this.primeiro && fase === 'morto' ? duracao : undefined);
    this.golpe = Math.max(0, this.golpe - dt);
    this.fase = fase; this.primeiro = false;
  }
}
