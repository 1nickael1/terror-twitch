// Chefe da fase 1 (entidade 096): inerte até ser visto, persegue e busca a última posição vista,
// arromba portas e, na arena, alterna investidas e pausas. Lógica pura.
import { CHEFE_096, IA, JOGADOR, NUVEM, PORTA } from '../balance';
import { comandarPorta, solidoDe } from '../doors';
import type { SimEvent } from '../eventos';
import {
  alturaPiso, caminho, CELL, centro, coordDe, DEGRAU, naArea, SALTO, visivel, type Solido, type Vec2,
} from '../grid';
import { resolverOnde } from '../onde';
import { celulaFechada } from '../perigos';
import { frente } from '../player';
import type { EstadoChefe096, FaseChefe096, Inimigo, ModoIA, World } from '../world';
import { confirmarMorteChefe, contarPassos, inimigoDoChefe } from './chefeComum';
import type { IaDeChefe } from './chefes';
import { ferirJogador } from './comum';
import { andar, celulaMaisProxima, encarar, linhaAndavel, normalizar, yawPara } from './movimento';
import { aoAlcance, distanciaJogador, linhaDeVisao } from './percepcao';
import { tipoDe, type TipoInimigo } from './tipos';
import { moverEntreInimigos } from './colisaoInimigos';

/** O `Inimigo.modo` do chefe é derivado da fase (para as views e a tensão). */
const MODO: Record<FaseChefe096, ModoIA> = {
  inerte: 'patrulha', despertando: 'suspeita', pausa: 'suspeita', procurando: 'suspeita',
  perseguicao: 'perseguicao', investida: 'perseguicao', arrombando: 'ataque', morto: 'morto',
};

export function modoDoChefe(f: FaseChefe096): ModoIA {
  return MODO[f];
}

/** Folga além do raio do corpo para contar como encostado na porta (maior que o passo de um quadro a 12 m/s, 0,2 m). */
const FOLGA_PORTA = 0.3;


/** O estado do chefe, se for o 096. */
function estado096(w: World): EstadoChefe096 | null {
  return w.chefe?.tipo === 'entidade096' ? w.chefe : null;
}

/**
 * O jogador mira no chefe: o olhar 3D (yaw e pitch) fica a até `olharAngulo` do vetor dos olhos
 * do jogador à cabeça do chefe (`y + altura * IA.olhos`), e a cabeça está visível.
 */
function miradoPeloJogador(w: World, i: Inimigo): boolean {
  const j = w.jogador;
  const olhos = j.y + JOGADOR.olhos;
  const cabeca = i.y + tipoDe(i.tipo).altura * IA.olhos;
  const dx = i.pos.x - j.pos.x;
  const dy = cabeca - olhos;
  const dz = i.pos.z - j.pos.z;
  const d = Math.hypot(dx, dy, dz);
  if (d > 1e-6) {
    const f = frente(j.yaw);
    const cp = Math.cos(j.pitch);
    const cos = (f.x * cp * dx + Math.sin(j.pitch) * dy + f.z * cp * dz) / d;
    if (cos < Math.cos(CHEFE_096.olharAngulo)) return false;
  }
  return visivel(w.grid, j.pos, i.pos, solidoDe(w), olhos, cabeca);
}

/** Dá para investir: vê o jogador e a linha reta até ele é andável (sem janela, grade, degrau alto nem queda > SALTO). */
function podeInvestir(w: World, i: Inimigo): boolean {
  return linhaDeVisao(w, i) && linhaAndavel(w, i, w.jogador.pos);
}

// --- transições ------------------------------------------------------------------------------

/** Desperta o chefe inerte (evento `chefe_desperta`). Sem chefe, ou já acordado, nada. */
export function despertarChefe(w: World): SimEvent[] {
  const c = estado096(w);
  if (!c || c.fase !== 'inerte') return [];
  c.fase = 'despertando';
  c.timer = CHEFE_096.despertar;
  const i = inimigoDoChefe(w);
  if (i && i.modo !== 'morto') {
    i.modo = MODO.despertando;
    i.ultimoVisto = { ...w.jogador.pos }; i.semVer = 0;
  }
  return [{ tipo: 'chefe_desperta' }];
}

function entrarPerseguicao(c: EstadoChefe096, i: Inimigo): void {
  c.fase = 'perseguicao';
  c.timer = 0;   // na perseguição, o timer é o preparo do golpe
  c.portaAlvo = null;
  c.investida = null;
  i.rotaEm = 0;
}

function entrarBusca(c: EstadoChefe096, i: Inimigo): void {
  c.fase = 'procurando'; c.timer = 0; c.investida = null;
  i.alvo = i.ultimoVisto ? { ...i.ultimoVisto } : { ...i.pos };
  i.rota = []; i.rotaEm = 0;
}

function entrarPausa(c: EstadoChefe096): void {
  c.fase = 'pausa';
  c.timer = CHEFE_096.pausa;
  c.investida = null;
}

/** Investida na direção do jogador de agora: `preparoInvestida` s parado e depois a corrida. */
function entrarInvestida(w: World, c: EstadoChefe096, i: Inimigo): SimEvent[] {
  const dx = w.jogador.pos.x - i.pos.x;
  const dz = w.jogador.pos.z - i.pos.z;
  const d = Math.hypot(dx, dz);
  const dir = d > 1e-6 ? { x: dx / d, z: dz / d } : frente(i.yaw);
  c.fase = 'investida';
  // preparo parado antes de correr (o urro sai agora); a direção fica a do início do preparo
  c.timer = CHEFE_096.investidaMax + CHEFE_096.preparoInvestida;
  c.investida = dir;
  i.yaw = yawPara(dir.x, dir.z);
  return [{ tipo: 'chefe_investida' }];
}

// --- fases -----------------------------------------------------------------------------------

/** Parado, de costas. Desperta com a mira acumulada, com o jogador perto ou com qualquer dano. */
function inerte(w: World, c: EstadoChefe096, i: Inimigo, t: TipoInimigo, dt: number): SimEvent[] {
  if (miradoPeloJogador(w, i)) c.olhar += dt;
  const ferido = i.vida < t.vida;   // a vida só cai enquanto inerte: dano por tiro, nuvem ou comporta
  if (c.olhar >= CHEFE_096.olharTempo || distanciaJogador(w, i) <= CHEFE_096.distanciaDespertar || ferido) {
    return despertarChefe(w);
  }
  return [];
}

/** Parado, virando para o jogador (meia-volta no tempo todo); depois persegue. */
function despertando(w: World, c: EstadoChefe096, i: Inimigo, dt: number): SimEvent[] {
  const alvo = yawPara(w.jogador.pos.x - i.pos.x, w.jogador.pos.z - i.pos.z);
  const giro = (Math.PI / CHEFE_096.despertar) * dt;
  const falta = normalizar(alvo - i.yaw);
  i.yaw = normalizar(i.yaw + Math.max(-giro, Math.min(giro, falta)));
  c.timer -= dt;
  if (c.timer <= 0) entrarPerseguicao(c, i);
  return [];
}

/**
 * Segue o jogador visível ou sua última posição conhecida. Na arena, com linha de visão, investe. A `alcanceAtaque`,
 * golpeia como os inimigos comuns: `preparo` virado para ele (em `c.timer`), golpe se ainda está a
 * `alcanceAtaque * 1.2`, e `espera = cadencia`. Senão, segue a rota.
 */
function perseguir(w: World, c: EstadoChefe096, i: Inimigo, t: TipoInimigo, vel: number, dt: number): SimEvent[] {
  const j = w.jogador;
  const vendo = linhaDeVisao(w, i);
  if (vendo) { i.ultimoVisto = { ...j.pos }; i.semVer = 0; }
  else {
    i.semVer += dt;
    // Despertar por gatilho/dano fornece uma posição inicial; depois não rastreia através de paredes.
    i.ultimoVisto ??= { ...j.pos };
    if (i.semVer >= CHEFE_096.perderDeVista && c.timer <= 0) { entrarBusca(c, i); return []; }
  }
  if (c.timer > 0) {
    encarar(i, j.pos);
    c.timer -= dt;
    if (c.timer > 0) return [];
    c.timer = 0;
    i.espera = t.cadencia;
    return vendo && aoAlcance(w, i, t, t.alcanceAtaque * 1.2) ? ferirJogador(w, t.dano, i.pos) : [];
  }
  if (c.naArena && podeInvestir(w, i)) return entrarInvestida(w, c, i);
  if (vendo && aoAlcance(w, i, t, t.alcanceAtaque)) {
    encarar(i, j.pos);
    if (i.espera > 0) return [];
    c.timer = t.preparo;
    return [{ tipo: 'inimigo_ataque', id: i.id }];
  }
  return seguirRota(w, c, i, t, vel, dt, i.ultimoVisto ?? j.pos);
}

/** Procura perto da última posição vista; só retoma a corrida quando enxerga o jogador. */
function procurar(w: World, c: EstadoChefe096, i: Inimigo, t: TipoInimigo, lentidao: number, dt: number): SimEvent[] {
  if (linhaDeVisao(w, i)) {
    i.ultimoVisto = { ...w.jogador.pos }; i.semVer = 0; i.alvo = null;
    entrarPerseguicao(c, i); return [];
  }
  const origem = i.ultimoVisto ?? i.pos;
  const destino = i.alvo ?? origem;
  const eventos = seguirRota(w, c, i, t, CHEFE_096.velocidadeBusca * lentidao, dt, destino);
  if (c.fase !== 'procurando') return eventos;
  if (Math.hypot(destino.x - i.pos.x, destino.z - i.pos.z) < IA.chegada || (i.refugio && i.rota.length === 0)) {
    // Pequeno circuito local, sem consultar a posição escondida do jogador.
    const direcoes = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    let achou = false;
    for (let n = 0; n < direcoes.length; n++) {
      const [x, z] = direcoes[i.patrulhaI++ % direcoes.length];
      const ponto = { x: origem.x + x * CELL, z: origem.z + z * CELL };
      if (!linhaAndavel(w, i, ponto)) continue;
      i.alvo = ponto; i.rotaEm = 0; achou = true; break;
    }
    if (!achou) i.yaw = normalizar(i.yaw + dt * IA.giroOlhando);
  }
  return eventos;
}

/** Para a rota do chefe, portas não contam (ele arromba): só as células fechadas por perigo. */
function solidoRotaChefe(w: World): Solido {
  return (col, row) => celulaFechada(w, col, row);
}

/**
 * Em linha reta quando dá; senão pela rota (recalculada a cada `IA.intervaloRota`), que passa por
 * portas fechadas e trancadas. Encostado numa porta da rota que não está abrindo: arromba. Sem
 * rota até o jogador, vai ao `refugio` (célula alcançável mais próxima dele) e espera virado para
 * ele; a cada recálculo tenta de novo a rota até o jogador.
 */
function seguirRota(w: World, c: EstadoChefe096, i: Inimigo, t: TipoInimigo, vel: number, dt: number, alvo: Vec2): SimEvent[] {
  if (linhaAndavel(w, i, alvo)) {
    i.rota = [];
    andar(w, i, alvo, vel, dt);
    return [];
  }
  if (i.rotaEm <= 0) {
    const solido = solidoRotaChefe(w);
    let rota = caminho(w.grid, i.pos, alvo, DEGRAU, solido, SALTO);
    let destino = alvo;
    i.refugio = null;
    if (rota === null) {
      // jogador inalcançável: vai à célula alcançável mais próxima dele e espera ali
      i.refugio = celulaMaisProxima(w, i, alvo, solido);
      destino = i.refugio;
      rota = caminho(w.grid, i.pos, destino, DEGRAU, solido, SALTO);
    }
    i.rotasCalculadas++;
    i.rotaEm = IA.intervaloRota;
    i.rota = rota === null ? [] : rota.length > 0 ? rota : [{ x: destino.x, z: destino.z }];
  }
  const prox = i.rota[0];
  if (!prox) {
    encarar(i, alvo);
    return [];
  }
  const [col, row] = coordDe(prox);
  const porta = w.portas.find((p) => p.coord[0] === col && p.coord[1] === row);
  if (porta && porta.abertura < PORTA.livreEm) {
    if (porta.estado === 'abrindo') {
      encarar(i, prox);
      return [];
    }
    if (Math.hypot(prox.x - i.pos.x, prox.z - i.pos.z) <= CELL / 2 + t.raio + FOLGA_PORTA) {
      c.fase = 'arrombando';
      c.timer = CHEFE_096.arrombar;
      c.portaAlvo = porta.id;
      encarar(i, prox);
      return [{ tipo: 'chefe_arromba', porta: porta.id }];
    }
  }
  if (andar(w, i, prox, vel, dt)) i.rota.shift();
  if (i.rota.length === 0 && i.refugio) encarar(i, alvo);
  return [];
}

/**
 * `arrombar` segundos na porta; depois ela abre, mesmo trancada, e ele volta a perseguir. Se ela
 * já deixa passar (aberta por outro), volta a perseguir na hora.
 */
function arrombando(w: World, c: EstadoChefe096, i: Inimigo, dt: number): SimEvent[] {
  const porta = w.portas.find((p) => p.id === c.portaAlvo);
  if (porta && porta.abertura >= PORTA.livreEm) {
    entrarPerseguicao(c, i);
    return [];
  }
  c.timer -= dt;
  if (c.timer > 0) return [];
  const id = c.portaAlvo;
  entrarPerseguicao(c, i);
  return id ? comandarPorta(w, id, 'abrir') : [];
}

/** Componente da direção acima disto conta para dizer que a colisão parou aquele eixo. */
const EIXO_RELEVANTE = 0.2;

/**
 * Bateu: a colisão zerou um eixo em que a direção tem componente relevante (assim não escorrega
 * pela parede em ângulo), ou andou menos de 90% do passo.
 */
function bateu(antes: Vec2, depois: Vec2, dir: Vec2, passo: number): boolean {
  const mx = depois.x - antes.x;
  const mz = depois.z - antes.z;
  if (Math.abs(dir.x) > EIXO_RELEVANTE && Math.abs(mx) < Math.abs(dir.x * passo) * 0.5) return true;
  if (Math.abs(dir.z) > EIXO_RELEVANTE && Math.abs(mz) < Math.abs(dir.z * passo) * 0.5) return true;
  return Math.hypot(mx, mz) < passo * 0.9;
}

/**
 * Depois do preparo (`c.timer` acima de `investidaMax`), corre em linha reta a `investidaVel` por até `investidaMax` ou até bater (`bateu`). Passando a `investidaGolpe` do jogador, golpeia uma vez. Depois, pausa.
 */
function investir(w: World, c: EstadoChefe096, i: Inimigo, t: TipoInimigo, lentidao: number, dt: number): SimEvent[] {
  const dir = c.investida;
  if (!dir) {
    entrarPausa(c);
    return [];
  }
  if (c.timer > CHEFE_096.investidaMax) {
    // preparo: parado, virado para a direção da investida
    c.timer -= dt;
    return [];
  }
  const passo = CHEFE_096.investidaVel * lentidao * dt;
  const antes = i.pos;
  i.pos = moverEntreInimigos(w, i, dir.x * passo, dir.z * passo);
  i.y = alturaPiso(w.grid, i.pos);
  if (aoAlcance(w, i, t, CHEFE_096.investidaGolpe)) {
    entrarPausa(c);
    return ferirJogador(w, t.dano, i.pos);
  }
  c.timer -= dt;
  if (bateu(antes, i.pos, dir, passo) || c.timer <= 0) entrarPausa(c);
  return [];
}

/** Parado, encolhido. Depois investe de novo se pode (`podeInvestir`); senão, persegue. */
function pausar(w: World, c: EstadoChefe096, i: Inimigo, dt: number): SimEvent[] {
  c.timer -= dt;
  if (c.timer > 0) return [];
  if (podeInvestir(w, i)) return entrarInvestida(w, c, i);
  entrarPerseguicao(c, i);
  return [];
}

/**
 * Um passo do chefe 096. O `Inimigo` morto (tiro, comporta, robô) leva à fase `morto`, com
 * `chefe_morto` uma vez. Ao fim, `i.modo` segue a fase (`modoDoChefe`).
 */
export function avancarChefe096(w: World, i: Inimigo, dt: number): SimEvent[] {
  const c = estado096(w);
  if (!c) return [];
  if (i.modo === 'morto') return confirmarMorteChefe(w);
  const t = tipoDe(i.tipo);
  i.espera = Math.max(0, i.espera - dt);
  i.rotaEm = Math.max(0, i.rotaEm - dt);
  const lentidao = i.lento > 0 ? NUVEM.lentidao : 1;
  i.lento = Math.max(0, i.lento - dt);
  const arena = w.fase.chefe?.arena;
  if (c.fase !== 'inerte' && !c.naArena && arena && naArea(i.pos, arena)) c.naArena = true;

  const faseAntes = c.fase;
  const antes = { x: i.pos.x, z: i.pos.z };
  let eventos: SimEvent[] = [];
  switch (c.fase) {
    case 'inerte':
      eventos = inerte(w, c, i, t, dt);
      break;
    case 'despertando':
      eventos = despertando(w, c, i, dt);
      break;
    case 'perseguicao':
      eventos = perseguir(w, c, i, t, CHEFE_096.velocidadePerseguicao * lentidao, dt);
      break;
    case 'procurando':
      eventos = procurar(w, c, i, t, lentidao, dt);
      break;
    case 'arrombando':
      eventos = arrombando(w, c, i, dt);
      break;
    case 'investida':
      eventos = investir(w, c, i, t, lentidao, dt);
      break;
    case 'pausa':
      eventos = pausar(w, c, i, dt);
      break;
    case 'morto':
      break;
  }
  i.modo = MODO[c.fase];
  return faseAntes === 'perseguicao' || faseAntes === 'investida' || faseAntes === 'procurando' ? [...eventos, ...contarPassos(c, antes, i.pos, CHEFE_096.passoMetros)] : eventos;
}

/** Restauro com o 096 acordado (nem inerte nem morto): volta na `retomada`, `despertando` com `CHEFE_096.retomada`. */
export function retomarChefe096(w: World): void {
  const c = estado096(w);
  const def = w.fase.chefe;
  if (!c || !def || c.fase === 'inerte' || c.fase === 'morto') return;
  const i = inimigoDoChefe(w);
  // morto no mesmo passo em que o checkpoint gravou (comporta num gatilho): a fase vira 'morto' no próximo passo
  if (!i || i.modo === 'morto') return;
  i.pos = centro(resolverOnde(w.grid, def.retomada));
  i.y = alturaPiso(w.grid, i.pos);
  i.rota = [];
  i.rotaEm = 0;
  i.espera = 0;
  i.ultimoVisto = { ...w.jogador.pos }; i.semVer = 0; i.alvo = null;
  c.fase = 'despertando';
  i.modo = modoDoChefe(c.fase);
  c.timer = CHEFE_096.retomada;
  c.portaAlvo = null;
  c.investida = null;
}

/** Estado inicial do 096: inerte. */
function criarEstado096(inimigoId: number): EstadoChefe096 {
  return { tipo: 'entidade096', inimigoId, fase: 'inerte', timer: 0, olhar: 0, naArena: false, portaAlvo: null, investida: null, passo: 0 };
}

/** A IA do 096 no registro de `ai/chefes.ts`. */
export const IA_096: IaDeChefe = {
  avancar: avancarChefe096,
  criarEstado: criarEstado096,
  retomar: retomarChefe096,
  despertar: despertarChefe,
};
