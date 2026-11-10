/** A paleta dos modelos identifica a superfície sem alterar suas posições ou a colisão. */
export function superficieDoProp(cor: number): 'madeira' | 'tecido' | 'borracha' | 'papel' | 'aco' | 'metal-pintado' | 'vidro' {
  if ([0x7d6e58, 0x8a6a42, 0xb59a6a].includes(cor)) return 'madeira';
  if ([0x2c3236, 0x8fa596, 0x5f6d5e, 0xc3c9c2, 0xe0e2dc, 0x6f6a5c].includes(cor)) return 'tecido';
  if ([0x1c1f22, 0x2a2f2b].includes(cor)) return 'borracha';
  if ([0xd8d4c4, 0xe0dccc].includes(cor)) return 'papel';
  if ([0x8f959b, 0x7d8489, 0xb9bec2, 0x8c9399, 0x9aa1a6].includes(cor)) return 'aco';
  if ([0x7a8f52, 0x9a6a3a, 0xc8dcd6].includes(cor)) return 'vidro';
  return 'metal-pintado';
}
