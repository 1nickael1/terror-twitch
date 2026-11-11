// Fase 2: textos originais (documentos internos da ala e mensagens do sistema de avisos).
import type { DocumentoDef } from '../../sim/fase';

/** Vírgula decimal, sem zeros sobrando. */
const s = (n: number) => String(n).replace('.', ',');

/** Mensagens dos gatilhos, no tom do sistema de avisos da ala. */
export const MENSAGENS = {
  entrada: 'Ala Médica M-1, triagem. Pacientes do subsolo em observação. Não se aproxime de quem não responde.',
  triagemLivre: 'Triagem liberada. Posto de enfermagem acessível.',
  enfermaria: 'Enfermaria geral. Nem todo corpo deitado está morto: atire antes de passar perto.',
  observacao: 'Laboratório de patologia. A equipe de enfermagem lá dentro não responde a chamados.',
  antecamara: 'Necrotério à frente. O elevador de macas desce ao anfiteatro cirúrgico.',
  elevadorAberto: 'Elevador de macas no andar. Porta aberta.',
  elevadorDescendo: 'Elevador em movimento. Destino: anfiteatro cirúrgico.',
  elevadorChegou: 'Anfiteatro cirúrgico, nível de observação. Recolha o cartão nível 3 no corredor e apresente-o no acesso restrito.',
  anfiteatro: 'Anfiteatro: UV no piso (terminais oeste e leste), vapor nas arquibancadas (norte e sul). Atraia-o até a área e use o terminal.',
  chefeFerido: 'Ferido, ele levanta os mortos com mais pressa. Não deixe corpos perto dele.',
  fim: 'Visitante imobilizado. Alarme encerrado. Saída de emergência liberada.',
} as const;

/** Mensagem do travamento do necrotério com o tempo real de chegada do elevador (s). */
export function mensagemNecroterio(segundos: number): string {
  return `Necrotério travado. Elevador de macas chamado: chegada em ${s(segundos)} s.`;
}

/** Contagem do elevador: segundos que faltam. */
export function mensagemContagem(faltam: number): string {
  return `Elevador de macas: ${s(faltam)} s.`;
}

export const DOCUMENTOS: DocumentoDef[] = [
  {
    id: 'recado-triagem',
    em: [15, 1],
    titulo: 'Recado preso no balcão da triagem',
    texto: 'Equipe da noite: a partir de hoje, todo paciente que sobe do subsolo passa pela triagem antes de '
      + 'ir para a enfermaria, mesmo que chegue sem pulso. É ordem da coordenação médica, sem exceção. Não '
      + 'deixem ninguém nas macas do corredor; usem os leitos com cortina e anotem o horário de entrada na '
      + 'pulseira. Se algum deles se mexer depois de declarado, não chamem o plantonista: fechem a ala e '
      + 'avisem o posto. Sei que parece absurdo. Só sigam o protocolo. — Enfermeira-chefe, plantão C',
  },
  {
    id: 'memorando-patologia',
    em: [37, 2],
    titulo: 'Memorando: rotina do laboratório de patologia',
    texto: 'A amostra trazida do anfiteatro na terça continua ativa. Tecido que deveria estar inerte reage a '
      + 'estímulo elétrico e, o que é pior, ao som de vozes. As enfermeiras destacadas para a coleta foram '
      + 'expostas e desde então trabalham sem pausa, sem falar e sem comer. Seguem enchendo frascos com a '
      + 'solução amarela do armário quatro e não deixam ninguém chegar perto da sala limpa. Não tentem '
      + 'contê-las sem proteção no rosto. O cartão de nível 2 da coordenação ficou lá dentro, na bancada. '
      + '— Patologia, turno da manhã',
  },
  {
    id: 'relato-anfiteatro',
    em: [50, 14],
    titulo: 'Relato do instrumentador, anfiteatro 2',
    texto: 'Ele entrou pela galeria de observação, de capa escura e máscara de bico, com uma maleta, como quem '
      + 'chega para uma consulta marcada. Não correu nem gritou. Encostou a mão no ombro do Lopes e o Lopes '
      + 'caiu como se tivessem desligado alguma coisa dentro dele. Pouco depois, outro corpo da mesa se '
      + 'levantou com um jeito estranho de andar. O anfiteatro tem lâmpadas de esterilização no piso e '
      + 'válvulas de vapor nas arquibancadas, cada uma com terminal na parede. Usem. Ele é lento, mas nunca '
      + 'para. — Instrumentador de plantão',
  },
];
