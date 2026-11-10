import { CAMERA } from './camera';
import { DISQUETE } from './disquete';
import { FITA } from './fita';
import { LANTERNA } from './lanterna';
import type { VisualStyle } from './types';

export const STYLES: readonly VisualStyle[] = [DISQUETE, FITA, LANTERNA, CAMERA];

export function getStyle(id: string): VisualStyle | undefined {
  return STYLES.find((s) => s.id === id);
}
