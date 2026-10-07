/**
 * Matemática do consórcio.
 *
 * Modelo usado (o mesmo das tabelas das administradoras):
 *   - O plano tem um valor total = crédito + taxa de administração + fundo de reserva.
 *   - Esse total é dividido pelo prazo: essa é a parcela base.
 *   - O seguro prestamista, quando existe, entra por fora, como % do crédito ao mês.
 *   - O lance abate o saldo devedor do plano. Lance embutido sai do próprio crédito
 *     (o cliente recebe menos); lance próprio sai do bolso.
 *
 * Quando o vendedor informa a parcela à mão (`parcelaManual`), ela manda: é o número
 * que está na tabela da administradora, e somar taxa com fundo de reserva quase nunca
 * chega nele. Nesse caso o caminho se inverte — o total do plano passa a ser deduzido
 * da parcela, e não o contrário.
 *
 * Consequência importante e verdadeira: o lance embutido NÃO muda o custo do consórcio,
 * só antecipa a contemplação e reduz o crédito recebido.
 */

export type Reducao = "parcela" | "prazo";

export interface EntradaSimulacao {
  credito: number;
  prazoMeses: number;
  /** % total sobre o crédito */
  taxaAdm: number;
  /** % total sobre o crédito */
  fundoReserva: number;
  /** % ao mês sobre o crédito */
  seguroMensal: number;
  lanceProprio: number;
  /** % do crédito */
  lanceEmbutidoPct: number;
  /** 0 = sem contemplação prevista */
  mesContemplacao: number;
  reducao: Reducao;
  /**
   * Parcela cheia da tabela da administradora, informada à mão. Quando vem
   * preenchida, substitui a parcela calculada e o total do plano é refeito a
   * partir dela. Nulo ou 0 = calcula pelas taxas.
   */
  parcelaManual?: number | null;
}

export interface ResultadoSimulacao {
  totalPlano: number;
  parcelaBase: number;
  seguro: number;
  parcela: number;
  /** a parcela veio da tabela, digitada pelo vendedor */
  parcelaInformada: boolean;

  lanceEmbutido: number;
  lanceTotal: number;
  creditoLiquido: number;
  temLance: boolean;
  /** true quando o lance quita o plano inteiro */
  lanceQuita: boolean;

  /** meses pagos na parcela cheia, antes da contemplação */
  mesesAntes: number;
  novaParcela: number;
  novoPrazo: number;
  mesesPagos: number;

  desembolso: number;
}

const arred = (v: number) => Math.round(v * 100) / 100;

export function simular(e: EntradaSimulacao): ResultadoSimulacao {
  const credito = Math.max(0, e.credito);
  const prazo = Math.max(1, Math.round(e.prazoMeses));

  const seguro = (credito * e.seguroMensal) / 100;

  // A parcela digitada é a cheia, com seguro dentro — é assim que a administradora
  // apresenta. Tiramos o seguro para achar a parcela base, que é a que amortiza o
  // plano e sobre a qual o lance incide.
  const parcelaInformada = (e.parcelaManual ?? 0) > 0;
  const parcelaBase = parcelaInformada
    ? Math.max(0, e.parcelaManual! - seguro)
    : (credito * (1 + e.taxaAdm / 100 + e.fundoReserva / 100)) / prazo;
  const totalPlano = parcelaBase * prazo;
  const parcela = parcelaBase + seguro;

  const lanceEmbutido = (credito * Math.min(e.lanceEmbutidoPct, 100)) / 100;
  const lanceTotal = lanceEmbutido + Math.max(0, e.lanceProprio);
  const creditoLiquido = credito - lanceEmbutido;
  const temLance = lanceTotal > 0;

  // mês da contemplação: 0 desliga o bloco de lance
  const mesesAntes = Math.min(Math.max(0, Math.round(e.mesContemplacao)), prazo);
  const pagoEmParcelas = parcelaBase * mesesAntes;
  const saldo = Math.max(0, totalPlano - pagoEmParcelas - lanceTotal);
  const lanceQuita = temLance && saldo === 0;

  let novoPrazo: number;
  let novaParcela: number;

  if (!temLance || mesesAntes >= prazo) {
    novoPrazo = prazo - mesesAntes;
    novaParcela = parcela;
  } else if (e.reducao === "parcela") {
    novoPrazo = prazo - mesesAntes;
    novaParcela = novoPrazo > 0 ? saldo / novoPrazo + seguro : 0;
  } else {
    novoPrazo = parcelaBase > 0 ? Math.ceil(saldo / parcelaBase) : 0;
    novaParcela = novoPrazo > 0 ? parcela : 0;
  }

  const mesesPagos = mesesAntes + novoPrazo;

  // O lance embutido sai do crédito, não do bolso — por isso entra abatendo.
  const desembolso = totalPlano - lanceEmbutido + seguro * mesesPagos;

  return {
    totalPlano: arred(totalPlano),
    parcelaBase: arred(parcelaBase),
    seguro: arred(seguro),
    parcela: arred(parcela),
    parcelaInformada,
    lanceEmbutido: arred(lanceEmbutido),
    lanceTotal: arred(lanceTotal),
    creditoLiquido: arred(creditoLiquido),
    temLance,
    lanceQuita,
    mesesAntes,
    novaParcela: arred(novaParcela),
    novoPrazo,
    mesesPagos,
    desembolso: arred(desembolso),
  };
}

/**
 * Financiamento Price, para o comparativo. `jurosMes` em % ao mês.
 *
 * A entrada abate o valor financiado e volta somada no total, porque é dinheiro
 * que o cliente tira do bolso no dia da compra — ignorá-la fazia o financiamento
 * parecer mais barato do que é.
 */
export function financiamento(valor: number, meses: number, jurosMes: number, entrada = 0) {
  const paga = Math.min(Math.max(0, entrada), valor);
  const financiado = valor - paga;
  const i = jurosMes / 100;
  const n = Math.max(1, Math.round(meses));
  const parcela = i === 0 ? financiado / n : (financiado * i) / (1 - Math.pow(1 + i, -n));
  const total = paga + parcela * n;
  return {
    entrada: arred(paga),
    financiado: arred(financiado),
    parcela: arred(parcela),
    total: arred(total),
    juros: arred(total - valor),
  };
}
