// Coleta de pickups: vida, colete, munição, armas e cartões. Lógica pura.
import { ARMAS, JOGADOR, MUNICAO_MAX, MUNICAO_PADRAO_PICKUP, PICKUP } from './balance';
import { curar } from './damage';
import type { SimEvent } from './eventos';
import type { PickupDef, TipoMunicao } from './fase';
import { selecionar } from './weapons';
import type { Jogador, World } from './world';

/** Soma munição até o máximo. Devolve false (sem mudar nada) se já está no máximo ou não há o que somar. */
function somarMunicao(j: Jogador, tipo: TipoMunicao, quantidade: number): boolean {
  if (quantidade <= 0 || j.municao[tipo] >= MUNICAO_MAX[tipo]) return false;
  j.municao[tipo] = Math.min(MUNICAO_MAX[tipo], j.municao[tipo] + quantidade);
  return true;
}

/**
 * Aplica o pickup ao jogador. Devolve `null` quando ele não serviria (o pickup fica no chão),
 * senão os eventos extras da coleta (`arma_trocada` ao pegar arma nova).
 */
function aplicar(w: World, def: PickupDef): SimEvent[] | null {
  const j = w.jogador;
  const sim = (serviu: boolean): SimEvent[] | null => (serviu ? [] : null);
  switch (def.tipo) {
    case 'vida_p':
    case 'vida_g': {
      if (j.vida >= JOGADOR.vidaMax) return null;
      j.vida = curar(j, PICKUP[def.tipo], 0).vida;
      return [];
    }
    case 'colete_p':
    case 'colete_g': {
      if (j.colete >= JOGADOR.coleteMax) return null;
      j.colete = curar(j, 0, PICKUP[def.tipo]).colete;
      return [];
    }
    case 'municao':
      if (!def.municao) return null;
      return sim(somarMunicao(j, def.municao, def.quantidade ?? MUNICAO_PADRAO_PICKUP));
    case 'arma': {
      if (!def.arma) return null;
      const deu = somarMunicao(j, ARMAS[def.arma].municao, def.quantidade ?? 0);
      if (j.armas.includes(def.arma)) return sim(deu);
      j.armas.push(def.arma);
      // mesma troca da tecla: não encurta a espera de quem acabou de atirar
      return selecionar(w, def.arma);
    }
    case 'cartao':
      if (!def.nivel) return null;
      if (!j.cartoes.includes(def.nivel)) j.cartoes.push(def.nivel);
      return [];
  }
}

/** Coleta os pickups a até `PICKUP.raio` do jogador. */
export function coletar(w: World): SimEvent[] {
  const j = w.jogador;
  const ev: SimEvent[] = [];
  w.pickups.forEach((p, indice) => {
    if (p.pego || Math.hypot(p.pos.x - j.pos.x, p.pos.z - j.pos.z) > PICKUP.raio) return;
    const extras = aplicar(w, p.def);
    if (!extras) return;
    p.pego = true;
    ev.push({ tipo: 'pickup', indice }, ...extras);
  });
  return ev;
}
