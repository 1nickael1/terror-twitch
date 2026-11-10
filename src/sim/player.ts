// Movimento do jogador: aceleração, salto, gravidade, degraus e passos. Lógica pura.
import { JOGADOR, RUIDO } from './balance';
import type { SimEvent } from './eventos';
import { alturaPiso, DEGRAU, moverComColisao, type Grid, type Solido, type Vec2 } from './grid';
import type { InputFrame, Jogador } from './world';

export function frente(yaw: number): Vec2 {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}

export function direita(yaw: number): Vec2 {
  return { x: Math.cos(yaw), z: -Math.sin(yaw) };
}

export function olhar(j: Jogador, dYaw: number, dPitch: number): void {
  j.yaw += dYaw;
  j.pitch = Math.max(-JOGADOR.pitchMax, Math.min(JOGADOR.pitchMax, j.pitch + dPitch));
}

/** `y` é a altura inicial dos pés (quem tem a grade passa `alturaPiso`). */
export function criarJogador(pos: Vec2, yaw: number, y = 0): Jogador {
  return {
    pos: { x: pos.x, z: pos.z }, y, vy: 0, vel: { x: 0, z: 0 }, yaw, pitch: 0, noChao: true,
    vida: JOGADOR.vidaMax, colete: 0, lanterna: true, cartoes: [],
    armas: ['pistola'], arma: 'pistola', municao: { balas: 0, cartuchos: 0, leves: 0, capsulas: 0 },
    espera: 0, rajada: 0, gatilho: false, puloApertado: false, passoAcum: 0, reservaPistola: 0, tiroPendente: 0,
  };
}

/** Aproxima `vel` de `alvo` sem passar dele, variando no máximo `max` neste passo. */
function aproximar(vel: Vec2, alvo: Vec2, max: number): void {
  const dx = alvo.x - vel.x;
  const dz = alvo.z - vel.z;
  const d = Math.hypot(dx, dz);
  if (d <= max) {
    vel.x = alvo.x;
    vel.z = alvo.z;
  } else {
    vel.x += (dx / d) * max;
    vel.z += (dz / d) * max;
  }
}

/** move, aplica gravidade e salto; devolve eventos 'pulo', 'pouso', 'passo' e 'ruido' */
export function moverJogador(g: Grid, j: Jogador, input: InputFrame, dt: number, solido?: Solido): SimEvent[] {
  const eventos: SimEvent[] = [];

  // velocidade horizontal
  const f = frente(j.yaw);
  const d = direita(j.yaw);
  let ax = f.x * input.frente + d.x * input.lado;
  let az = f.z * input.frente + d.z * input.lado;
  const n = Math.hypot(ax, az);
  const rapidez = input.devagar ? JOGADOR.velocidadeDevagar : JOGADOR.velocidade;
  if (n > 0) {
    ax = (ax / n) * rapidez;
    az = (az / n) * rapidez;
  }
  const taxa = JOGADOR.aceleracao * (j.noChao ? 1 : JOGADOR.controleNoAr);
  aproximar(j.vel, { x: ax, z: az }, taxa * dt);

  // salto na borda: segurar `pular` não pula de novo ao pousar
  if (j.noChao && input.pular && !j.puloApertado) {
    j.vy = JOGADOR.impulsoSalto;
    j.noChao = false;
    eventos.push({ tipo: 'pulo' });
  }
  j.puloApertado = input.pular;
  const estavaNoChao = j.noChao;
  if (!j.noChao) {
    // posição pela fórmula exata do passo: o topo é impulso²/(2g) ≈ SALTO, qualquer que seja o dt
    j.y += j.vy * dt - 0.5 * JOGADOR.gravidade * dt * dt;
    j.vy -= JOGADOR.gravidade * dt;
  }

  // movimento com colisão: no ar só entra onde o piso está na altura dos pés ou abaixo
  const antes = j.pos;
  const dx = j.vel.x * dt;
  const dz = j.vel.z * dt;
  j.pos = moverComColisao(g, antes, j.y, dx, dz, JOGADOR.raio, estavaNoChao ? DEGRAU : 0, solido);
  // no chão, eixo bloqueado perde a velocidade (moverComColisao devolve pos + d, ou pos, por eixo);
  // no ar não: quem raspa na lateral de uma plataforma ainda subindo precisa do embalo para entrar
  if (estavaNoChao) {
    if (j.pos.x !== antes.x + dx) j.vel.x = 0;
    if (j.pos.z !== antes.z + dz) j.vel.z = 0;
  }
  const andou = Math.hypot(j.pos.x - antes.x, j.pos.z - antes.z);

  // piso
  const piso = alturaPiso(g, j.pos);
  if (j.y <= piso || (estavaNoChao && Math.abs(j.y - piso) <= DEGRAU)) {
    j.y = piso;
    j.vy = 0;
    j.noChao = true;
    if (!estavaNoChao) {
      eventos.push({ tipo: 'pouso' });
      eventos.push({ tipo: 'ruido', pos: { x: j.pos.x, z: j.pos.z }, raio: RUIDO.pouso });
    }
  } else {
    j.noChao = false;
  }

  // passos: só correndo no chão; um trecho silencioso (devagar ou parado) recomeça a contagem
  if (input.devagar || andou === 0) {
    j.passoAcum = 0;
  } else if (estavaNoChao && j.noChao) {
    j.passoAcum += andou;
    if (j.passoAcum >= JOGADOR.passoMetros) {
      j.passoAcum -= JOGADOR.passoMetros;
      eventos.push({ tipo: 'passo', pos: { x: j.pos.x, z: j.pos.z } });
      eventos.push({ tipo: 'ruido', pos: { x: j.pos.x, z: j.pos.z }, raio: RUIDO.corrida });
    }
  }

  return eventos;
}
