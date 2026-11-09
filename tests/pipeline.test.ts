import { describe, expect, it } from 'vitest';
import { internalSize } from '../src/looks/pipeline';

describe('internalSize', () => {
  it('reduz para a altura interna mantendo o aspecto', () => {
    expect(internalSize(1920, 1080, 180)).toEqual({ w: 320, h: 180 });
  });
  it('null usa a resolução da tela', () => {
    expect(internalSize(1920, 1080, null)).toEqual({ w: 1920, h: 1080 });
  });
  it('nunca amplia acima da tela', () => {
    expect(internalSize(800, 600, 1000)).toEqual({ w: 800, h: 600 });
  });
  it('nunca chega a zero', () => {
    expect(internalSize(1, 4000, 180).w).toBeGreaterThanOrEqual(1);
  });
});
