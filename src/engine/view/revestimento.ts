// Revestimento de parede por fase (C3.5, correção 1): qual slot de material as paredes da malha estática usam.
// Lógica pura (sem three nem DOM).
import type { Revestimento } from '../../sim/fase';

/**
 * Renomeação de slots do `Coletor` para o revestimento da fase. Ausente ou `escritorio`: nada muda (a fase 1
 * segue idêntica). `azulejo`: as faces do slot `parede` (paredes, muretas e vergas das janelas) vão para
 * `parede-azulejo`; degraus, piso e teto continuam os mesmos.
 */
export function slotsDoRevestimento(r: Revestimento | undefined): Readonly<Record<string, string>> {
  return r === 'azulejo' ? { parede: 'parede-azulejo' } : {};
}

/**
 * Textura de azulejo: cobre `metros` × `metros` de parede (as UVs vêm em metros × `UV_POR_METRO` = 0,5: uma
 * repetição a cada 2 m), com `ladrilhos` × `ladrilhos` peças de `px / ladrilhos` pixels (14 → 14,3 cm, 32 px).
 */
export const AZULEJO = { px: 448, ladrilhos: 14, metros: 2 } as const;
