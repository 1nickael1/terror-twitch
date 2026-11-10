// Validador: nomes que a fase cita do catálogo (props, som de fundo, música, sons de gatilho). Lógica pura.
import { MUSICAS, SONS_DE_EVENTO, SONS_DE_FUNDO, TIPOS_PROP } from '../sim/catalogo';
import type { LevelDef, PropDef } from '../sim/fase';
import { celula, type Grid } from '../sim/grid';

/**
 * Passo (col, row) da célula da placa até a parede onde ela encosta, pela mesma regra da view
 * (`normalParede` em `engine/view/placasLogica.ts`): n = -z, s = +z, l = +x, o = -x; sem `parede`, a
 * placa olha para a frente do `yaw` (-sin yaw, -cos yaw) e encosta no lado oposto, arredondado ao eixo dominante.
 */
function ladoDaParede(p: PropDef): readonly [number, number] {
  switch (p.parede) {
    case 'n': return [0, -1];
    case 's': return [0, 1];
    case 'l': return [1, 0];
    case 'o': return [-1, 0];
    default: {
      const yaw = p.yaw ?? 0;
      const x = Math.sin(yaw);
      const z = Math.cos(yaw);
      return Math.abs(x) > Math.abs(z) ? [Math.sign(x), 0] : [0, Math.sign(z)];
    }
  }
}

/** Erros de props e de nomes de som. Texto vazio em `somDeFundo` ou `musica` = sem som (válido). */
export function errosDeCatalogo(f: LevelDef, g: Grid): string[] {
  const erros: string[] = [];
  f.props.forEach((p, i) => {
    if (!TIPOS_PROP.includes(p.tipo)) erros.push(`Prop #${i} tem tipo desconhecido "${p.tipo}"`);
    if (p.tipo !== 'placa') return;
    if (!p.texto?.trim()) erros.push(`Placa #${i} sem texto`);
    const [col, row] = p.em;
    if (celula(g, col, row).tipo !== 'piso') {
      erros.push(`Placa #${i} fora de célula andável`);
      return;
    }
    // fora da grade, `celula` devolve parede: placa na borda da grade vale
    const [dc, dr] = ladoDaParede(p);
    if (celula(g, col + dc, row + dr).tipo !== 'parede') erros.push(`Placa #${i} sem parede atrás`);
  });
  const { somDeFundo, musica } = f.ambiente;
  if (somDeFundo !== '' && !SONS_DE_FUNDO.includes(somDeFundo)) erros.push(`Som de fundo "${somDeFundo}" desconhecido`);
  if (musica !== '' && !MUSICAS.includes(musica)) erros.push(`Música "${musica}" desconhecida`);
  for (const gat of f.gatilhos) {
    for (const x of gat.faz) {
      if (x.acao === 'som' && !SONS_DE_EVENTO.includes(x.id)) erros.push(`Gatilho "${gat.id}" toca som "${x.id}" desconhecido`);
    }
  }
  return erros;
}
