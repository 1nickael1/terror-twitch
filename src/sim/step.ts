// Um passo da simulação: costura jogador, armas, portas, pickups, IA, segredos, gatilhos e saída. Lógica pura.
import { avancarInimigos } from './ai/comum';
import { avancarPortas, solidoDe, usar } from './doors';
import type { SimEvent } from './eventos';
import { coordDe, type Coord, type Vec2 } from './grid';
import { coletar } from './pickups';
import { moverJogador, olhar } from './player';
import { suavizarTensao, tensaoAlvo } from './tension';
import { avancarGatilhos, naArea } from './triggers';
import { atirar, avancarNuvens, avancarProjeteis, trocarArma } from './weapons';
import type { InputFrame, World } from './world';

export const PASSO = 1 / 60;

function naCelula(p: Vec2, c: Coord): boolean {
  const [col, row] = coordDe(p);
  return col === c[0] && row === c[1];
}

/** Usar um documento conta em `stats.documentos` uma vez só; o evento sai sempre. */
function contarDocumentos(w: World, eventos: readonly SimEvent[]): void {
  for (const e of eventos) {
    if (e.tipo === 'documento' && !w.stats.documentos.includes(e.id)) w.stats.documentos.push(e.id);
  }
}

/** Entrar na área de um segredo ainda não achado soma em `stats.segredos` e emite `segredo`. */
function acharSegredos(w: World): SimEvent[] {
  const ev: SimEvent[] = [];
  for (const s of w.fase.segredos) {
    if (w.stats.segredos.includes(s.id) || !naArea(w.jogador.pos, s.area)) continue;
    w.stats.segredos.push(s.id);
    ev.push({ tipo: 'segredo', id: s.id });
  }
  return ev;
}

/** Pisar numa célula de checkpoint ainda não usada marca a gravação (feita no fim de `avancarGatilhos`). */
function pisarCheckpoints(w: World): SimEvent[] {
  const ev: SimEvent[] = [];
  w.fase.checkpoints.forEach((c, indice) => {
    if (w.checkpointsUsados.includes(indice) || !naCelula(w.jogador.pos, c)) return;
    w.checkpointsUsados.push(indice);
    w.checkpointPendente = true;
    ev.push({ tipo: 'checkpoint' });
  });
  return ev;
}

/** Cronômetro ativo decresce; ao zerar, o jogador morre (sem `dano_jogador`: a morte por tempo é silenciosa). */
function avancarCronometro(w: World, dt: number): SimEvent[] {
  if (w.cronometro === null) return [];
  w.cronometro -= dt;
  if (w.cronometro > 0) return [];
  w.cronometro = null;
  w.jogador.vida = 0;
  w.estado = 'morto';
  return [{ tipo: 'jogador_morto' }];
}

/** Avança o mundo no lugar (sem E/S) e devolve os eventos do passo. Fora de `jogando`, nada muda. */
export function step(w: World, input: InputFrame, dt: number): SimEvent[] {
  if (w.estado !== 'jogando') return [];
  const j = w.jogador;
  const eventos: SimEvent[] = [];

  // 1. olhar, arma e lanterna (`lanterna` já chega como borda)
  olhar(j, input.dYaw, input.dPitch);
  eventos.push(...trocarArma(w, input));
  if (input.lanterna) j.lanterna = !j.lanterna;

  // 2. movimento
  eventos.push(...moverJogador(w.grid, j, input, dt, solidoDe(w)));

  // 3. usar
  if (input.usar) {
    const usados = usar(w);
    contarDocumentos(w, usados);
    eventos.push(...usados);
  }

  // 4. armas (projéteis de inimigo podem matar o jogador)
  eventos.push(...atirar(w, input, dt), ...avancarProjeteis(w, dt), ...avancarNuvens(w, dt));
  if (w.estado !== 'jogando') return eventos;

  // 5. portas e pickups
  eventos.push(...avancarPortas(w, dt), ...coletar(w));

  // 6. inimigos, com os ruídos deste passo
  const ruidos = eventos.flatMap((e) => (e.tipo === 'ruido' ? [{ pos: e.pos, raio: e.raio }] : []));
  eventos.push(...avancarInimigos(w, ruidos, dt));
  // morto aqui: nada de segredo, checkpoint, gatilho, cronômetro nem saída (não grava checkpoint morto)
  if (w.estado !== 'jogando') return eventos;

  // 7. segredos e checkpoints de célula (antes dos gatilhos, que gravam o checkpoint pendente)
  eventos.push(...acharSegredos(w), ...pisarCheckpoints(w));

  // 8. gatilhos com todos os eventos do passo
  eventos.push(...avancarGatilhos(w, eventos));

  // 9. cronômetro
  eventos.push(...avancarCronometro(w, dt));

  // 10. saída
  if (w.estado === 'jogando' && naCelula(w.jogador.pos, w.fase.saida)) {
    w.estado = 'concluida';
    eventos.push({ tipo: 'fase_concluida' });
  }

  // 11. tempo e tensão
  w.stats.tempo += dt;
  w.t += dt;
  w.tensao = suavizarTensao(w.tensao, tensaoAlvo(w), dt);
  return eventos;
}
