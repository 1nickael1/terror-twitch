// Gatilhos de evento da fase: condições, ações e checkpoint. Lógica pura.
import { iaDeChefe } from './ai/chefes';
import { adicionarInimigo } from './ai/comum';
import { SIRENE } from './balance';
import { tipoDe } from './ai/tipos';
import { comandarPorta } from './doors';
import type { SimEvent } from './eventos';
import type { Acao, Condicao } from './fase';
import { alturaPiso, centro, naArea } from './grid';
import { acionarPerigo } from './perigos';
import { gravarCheckpoint, type World } from './world';

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
    case 'chefe_vida': {
      const i = w.chefe ? w.inimigos.find((x) => x.id === w.chefe!.inimigoId) : undefined;
      return i !== undefined && i.vida / tipoDe(i.tipo).vida < c.abaixo;
    }
    case 'chefe_morto':
      return w.chefe?.fase === 'morto';
    case 'tempo': {
      // folga: o relógio soma `dt` a cada passo (120 × 1/60 pode ficar um fio abaixo de 2)
      if (!Object.prototype.hasOwnProperty.call(w.gatilhosQuando, c.desde)) return false;
      return w.relogio - w.gatilhosQuando[c.desde] >= c.apos - 1e-9;
    }
  }
}

/** Executa uma ação de gatilho e devolve os eventos dela. */
export function executar(w: World, acao: Acao): SimEvent[] {
  switch (acao.acao) {
    case 'porta':
      return comandarPorta(w, acao.id, acao.estado);
    case 'spawn':
      for (const def of acao.inimigos) adicionarInimigo(w, def);   // corpo só conta ao levantar
      return [];
    case 'alarme':
      w.alarme = acao.ligado;
      w.sirene = acao.ligado ? SIRENE.duracao : 0;
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
      return w.chefe ? iaDeChefe(w.chefe.tipo)?.despertar(w) ?? [] : [];
    case 'perigo':
      return acionarPerigo(w, acao.id);
  }
}

/**
 * Dispara os gatilhos cuja condição vale. `umaVez` (padrão) dispara uma vez só; `umaVez: false`
 * dispara a cada passo em que a condição passa a valer.
 * `eventos` são os eventos já produzidos neste passo (para condições 'pickup' e 'terminal').
 * Cada disparo grava `w.gatilhosQuando[id] = w.relogio` (base da condição `tempo`).
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
    w.gatilhosQuando[g.id] = w.relogio;
    ev.push({ tipo: 'gatilho', id: g.id });
    for (const acao of g.faz) ev.push(...executar(w, acao));
  }
  if (w.checkpointPendente) {
    gravarCheckpoint(w);
    w.checkpointPendente = false;
  }
  return ev;
}
