// Ala de contenção em L (~34 m de percurso). Legenda em levelData.ts.
// Antessala (cols 1–4) → corredor leste (linhas 2–3) → desce (cols 11–12) → porta arrombada D → cela com o monstro.
export const MAPA = [
  '###############',
  '#..T.#C#C#C####',
  '#P.......L....#',
  '#..L.........L#',
  '#....##C#C#A.##',
  '##########C..##',
  '###########D###',
  '#########..L..#',
  '#########..M..#',
  '#########.....#',
  '###############',
].join('\n');

/** O jogador começa olhando para o corredor (+x). */
export const SPAWN_YAW = -Math.PI / 2;
