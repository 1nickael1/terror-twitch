// Partitura original procedural: cama harmônica, pulso grave e motivo metálico.
// Um único laço do mixer, sem timers. Pausa e volume seguem o AudioContext do jogo.
import { laco, type Bancada, type Laco } from './sintese';

export function trilha(b: Bancada, destino: AudioNode, hospital: boolean): Laco {
  const { ctx } = b;
  const saida = ctx.createGain();
  const fontes: AudioScheduledSourceNode[] = [];
  const nos: AudioNode[] = [];
  const base = hospital ? 48.999 : 55;
  // Quintas abertas, segunda menor distante e desafinação lenta.
  for (const [i, razao] of [1, 1.004, 1.5, 2.001, 2.119].entries()) {
    const o = ctx.createOscillator();
    o.type = i < 2 ? 'triangle' : 'sine';
    o.frequency.value = base * razao;
    const g = ctx.createGain();
    g.gain.value = i < 2 ? .11 : .035;
    o.connect(g); g.connect(saida);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = .035 + i * .011;
    const profundidade = ctx.createGain();
    profundidade.gain.value = .016;
    lfo.connect(profundidade); profundidade.connect(g.gain);
    fontes.push(o, lfo); nos.push(g, profundidade);
  }
  // Motivo esparso, panorâmico, com caudas que atravessam a emenda do loop.
  const taxa = 22050;
  const duracao = 24;
  const buffer = ctx.createBuffer(2, taxa * duracao, taxa);
  const notas = hospital ? [0, 1, 7, 3, 0, 8, 7, 1] : [0, 7, 12, 1, 0, 7, 3, 1];
  for (let canal = 0; canal < 2; canal++) {
    const dados = buffer.getChannelData(canal);
    for (let n = 0; n < notas.length; n++) {
      const freq = base * 4 * 2 ** (notas[n] / 12);
      const inicio = Math.floor((n * 3 + (canal ? .17 : 0)) * taxa);
      for (let j = 0; j < taxa * 4; j++) {
        const t = j / taxa;
        const env = (1 - Math.exp(-t * 35)) * Math.exp(-t * 1.7);
        const metal = Math.sin(t * freq * Math.PI * 2) + .24 * Math.sin(t * freq * 2.763 * Math.PI * 2);
        dados[(inicio + j) % dados.length] += metal * env * .075 * (n % 2 === canal ? 1 : .55);
      }
    }
    for (let j = 0; j < dados.length; j++) {
      const t = j / taxa;
      const fase = t % 1.5;
      const batida = Math.exp(-fase * 12) * Math.min(1, fase * 120);
      dados[j] += Math.sin(t * base * Math.PI * 2) * batida * .14;
    }
  }
  const motivo = ctx.createBufferSource();
  motivo.buffer = buffer; motivo.loop = true; motivo.connect(saida);
  fontes.push(motivo);
  const loop = laco(ctx, destino, fontes, saida, 0);
  // O grafo inteiro é desconectado após o último fade, inclusive os LFOs.
  const parar = loop.parar;
  let encerrado = false;
  loop.parar = (t, rampa) => {
    if (encerrado) return;
    encerrado = true;
    fontes[0].addEventListener('ended', () => {
      for (const f of fontes) f.disconnect();
      for (const n of nos) n.disconnect();
    }, { once: true });
    parar(t, rampa);
  };
  return loop;
}
