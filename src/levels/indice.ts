// Índice das fases jogáveis, em ordem.
import type { LevelDef } from '../sim/fase';
import { fase1 } from './fase1';
import { fase2 } from './fase2';

export const FASES: readonly LevelDef[] = [fase1, fase2];
