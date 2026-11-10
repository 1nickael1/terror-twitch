// Fase 1: textos originais (documentos e mensagens do sistema de avisos da instalação).
import type { DocumentoDef } from '../../sim/fase';

/** Mensagens dos gatilhos, no tom do sistema de avisos do setor. */
export const MENSAGENS = {
  andar: 'Aviso automático: Setor L-2, recepção. Desloque-se com W A S D e olhe com o mouse.',
  porta: 'Portas de serviço: aproxime-se e pressione E.',
  lanterna: 'Iluminação reduzida neste trecho. Lanterna individual: F.',
  documento: 'Documentos deixados nas mesas podem ser lidos com E.',
  alarme: 'ALERTA: brecha de contenção no Setor L-2. Pessoal não essencial, evacuar pela triagem.',
  bloco: 'Bloco de celas L-2. Ocupante fora da cela deve ser tratado como hostil.',
  travamento: 'Travamento automático: sala de convivência isolada.',
  liberado: 'Travamento liberado. Acesso ao isolamento desbloqueado.',
  isolamento: 'ISOLAMENTO L-2-07. Não olhe para o ocupante.',
  desperta: 'Ocupante em movimento. Feche as portas atrás de você e siga para a triagem.',
  triagem: 'Triagem. As comportas são acionadas pelos terminais da cabine de controle.',
  fim: 'Ocupante imobilizado. Elevador de serviço liberado.',
} as const;

export const DOCUMENTOS: DocumentoDef[] = [
  {
    id: 'aviso-evacuacao',
    em: [17, 1],
    titulo: 'Aviso interno: evacuação do Setor L-2',
    texto: 'Ao toque contínuo do alarme, todo o pessoal administrativo deve interromper o trabalho, '
      + 'trancar as gavetas e seguir pela rota sinalizada até a triagem. Não use o elevador social. '
      + 'Não leve pastas, computadores nem objetos pessoais. A equipe de segurança tem prioridade nos '
      + 'corredores: fique junto à parede e obedeça às ordens sem discutir. Se avistar um ocupante fora '
      + 'da cela, não tente contê-lo. Afaste-se, feche as portas atrás de você e avise o posto mais '
      + 'próximo. Em nenhuma hipótese retorne ao setor antes da liberação oficial. '
      + '— Coordenação administrativa L-2',
  },
  {
    id: 'registro-observacao',
    em: [28, 22],
    titulo: 'Registro de observação: cela de isolamento L-2-07',
    texto: 'Turno da noite. O ocupante segue agachado no fundo da cela, imóvel desde a transferência do '
      + 'mês passado. A bandeja volta intacta e ele não reage quando a escotilha abre. Às vezes solta um '
      + 'som baixo e áspero que atravessa a porta e deixa o turno inteiro de nervos à flor da pele. Pelo '
      + 'protocolo, a equipe entra em dupla, com visor fosco, e ninguém usa a janela de observação por mais '
      + 'de alguns segundos. Lembrete aos novatos: o perigo não é ele notar vocês, é vocês o notarem. '
      + 'Depois disso, nenhuma porta do setor segura por muito tempo. — Técnico de turno, matrícula 4471',
  },
  {
    id: 'bilhete-cabine',
    em: [42, 33],
    titulo: 'Bilhete dobrado',
    texto: 'Marta, se você achar isto, eu não consegui passar pela triagem antes do travamento. Fiquei '
      + 'na cabine de controle com o Teixeira até as comportas pararem. Elas descem rápido e com força, '
      + 'e nada atravessa o vão enquanto estão fechadas. Os terminais ficam dentro da cabine, um para cada '
      + 'vão. Se aquilo acordar, não corra em linha reta pela sala: ele avança como um trem e só para '
      + 'quando bate em alguma coisa. Fique atrás do vidro, espere ele entrar no vão e acione. Diga às '
      + 'crianças que eu peguei o turno extra por elas. — R.',
  },
];
