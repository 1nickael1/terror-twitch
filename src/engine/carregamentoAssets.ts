export interface ProgressoAssets { concluidos: number; total: number }

/** Lote da engine: só termina depois do cadastro e da conclusão de todos os recursos. */
export class CarregamentoAssets {
  readonly pronto: Promise<void>;
  private resolver!: () => void;
  private rejeitar!: (erro: Error) => void;
  private progresso: ProgressoAssets = { concluidos: 0, total: 0 };
  private readonly falhas: string[] = [];
  private readonly ouvintes = new Set<(p: ProgressoAssets) => void>();
  private fechado = false;
  private encerrado = false;

  constructor() {
    this.pronto = new Promise((resolver, rejeitar) => { this.resolver = resolver; this.rejeitar = rejeitar; });
    // Também pode ser cancelado antes de a EngineStore receber a engine.
    void this.pronto.catch(() => {});
  }
  acompanhar(nome: string, tarefa: Promise<unknown>): void {
    if (this.fechado || this.encerrado) throw new Error('Lote de assets já fechado.');
    this.progresso = { ...this.progresso, total: this.progresso.total + 1 }; this.emitir();
    void tarefa.then(resultado => this.terminar(nome, resultado !== false), () => this.terminar(nome, false));
  }
  subscribe(ouvinte: (p: ProgressoAssets) => void): () => void {
    this.ouvintes.add(ouvinte); ouvinte(this.progresso);
    return () => { this.ouvintes.delete(ouvinte); };
  }
  fechar(): void { this.fechado = true; this.verificar(); }
  cancelar(): void {
    if (!this.encerrado) { this.encerrado = true; this.rejeitar(new Error('Carregamento cancelado.')); }
    this.ouvintes.clear();
  }
  private terminar(nome: string, sucesso: boolean): void {
    if (this.encerrado) return;
    if (!sucesso) this.falhas.push(nome);
    this.progresso = { ...this.progresso, concluidos: this.progresso.concluidos + 1 };
    this.emitir(); this.verificar();
  }
  private emitir(): void { for (const ouvinte of this.ouvintes) ouvinte(this.progresso); }
  private verificar(): void {
    if (this.encerrado || !this.fechado || this.progresso.concluidos !== this.progresso.total) return;
    this.encerrado = true;
    if (this.falhas.length) this.rejeitar(new Error('Não foi possível baixar todos os arquivos do jogo. Verifique a conexão e tente novamente.', { cause: [...this.falhas] }));
    else this.resolver();
    this.ouvintes.clear();
  }
}
