// Gatilhos de evento da fase: condições, ações e checkpoint. Lógica pura.
import { criarInimigo } from './ai/comum';
import { comandarPorta } from './doors';
import type { SimEvent } from './eventos';
import type { Acao, Area, Condicao } from './fase';
import { alturaPiso, centro, coordDe, type Vec2 } from './grid';
import { gravarCheckpoint, type World } from './world';

/** O ponto está numa das células do retângulo [col, row, larg, alt]. */
export function naArea(p: Vec2, a: Area): boolean {
  const [col, row] = coordDe(p);
  return col >= a[0] && col < a[0] + a[2] && row >= a[1] && row < a[1] + a[3];
}

function vale(w: World, c: Condicao, eventos: readonly SimEvent[]): boolean {
  switch (c.tipo) {
    case 'area':
      return naArea(w.jogador.pos, c.area);
    case 'pickup':
      return eventos.some((e) => e.tipo === 'pickup' && e.indice === c.indice);
    case 'terminal':
      return eventos.some((e) => e.tipo === 'terminal' && e.id === c.id);
    case 'grupo_morto': {
      const grupo = w.inimigos.filter((i) => i.grupo === c.grupo);
      return grupo.length > 0 && grupo.every((i) => i.modo === 'morto');
    }
    case 'chefe_vida':
      return false;   // o chefe entra no CP2
  }
}

/** Executa uma ação de gatilho e devolve os eventos dela. */
export function executar(w: World, acao: Acao): SimEvent[] {
  switch (acao.acao) {
    case 'porta':
      return comandarPorta(w, acao.id, acao.estado);
    case 'spawn':
      for (const def of acao.inimigos) {
        w.inimigos.push(criarInimigo(w, def));
        w.stats.totalInimigos++;
      }
      return [];
    case 'alarme':
      w.alarme = acao.ligado;
      return [{ tipo: 'alarme', ligado: acao.ligado }];
    case 'luz':
      if (acao.ligada) w.luzesDesligadas.delete(acao.grupo);
      else w.luzesDesligadas.add(acao.grupo);
      return [{ tipo: 'luz', grupo: acao.grupo, ligada: acao.ligada }];
    case 'som':
      return [{ tipo: 'som', id: acao.id }];
    case 'mensagem':
      return [{ tipo: 'mensagem', texto: acao.texto }];
    case 'checkpoint':
      w.checkpointPendente = true;   // gravado no fim de `avancarGatilhos`, depois de todas as ações
      return [{ tipo: 'checkpoint' }];
    case 'teleporte': {
      const j = w.jogador;
      j.pos = centro(acao.para);
      j.y = alturaPiso(w.grid, j.pos);
      j.vel = { x: 0, z: 0 };
      j.vy = 0;
      if (acao.yaw !== undefined) j.yaw = acao.yaw;
      return [];
    }
    case 'cronometro':
      w.cronometro = acao.segundos;
      return [];
    case 'chefe':
    case 'perigo':
      return [];   // entram no CP2; por ora, só o evento `gatilho` do disparo
  }
}

/**
 * Dispara os gatilhos cuja condição vale. `umaVez` (padrão) dispara uma vez só; `umaVez: false`
 * dispara a cada passo em que a condição passa a valer.
 * `eventos` são os eventos já produzidos neste passo (para condições 'pickup' e 'terminal').
 * Uma ação `checkpoint` grava só no fim, depois de todos os gatilhos e ações do passo.
 */
export function avancarGatilhos(w: World, eventos: readonly SimEvent[]): SimEvent[] {
  const ev: SimEvent[] = [];
  for (const g of w.fase.gatilhos) {
    const umaVez = g.umaVez ?? true;
    if (umaVez && w.gatilhosFeitos.has(g.id)) continue;
    const agora = vale(w, g.quando, eventos);
    if (umaVez) {
      if (!agora) continue;
      w.gatilhosFeitos.add(g.id);
    } else {
      const antes = w.gatilhosAtivos.has(g.id);
      if (agora) w.gatilhosAtivos.add(g.id);
      else w.gatilhosAtivos.delete(g.id);
      if (!agora || antes) continue;
    }
    ev.push({ tipo: 'gatilho', id: g.id });
    for (const acao of g.faz) ev.push(...executar(w, acao));
  }
  if (w.checkpointPendente) {
    gravarCheckpoint(w);
    w.checkpointPendente = false;
  }
  return ev;
}
