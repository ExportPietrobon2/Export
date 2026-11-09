const { banco } = require('../config/banco')

const NOMES_MESES = [
  '',
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro'
]

const DIAS_ALERTA_VENCIMENTO = 7

const CAMPOS_DV = ['nf', 'fatura', 'num_due', 'num_conhecimento', 'tipo', 'vendedor', 'produto', 'pais']
const SQL_NAO_DV = `NOT (${CAMPOS_DV.map((c) => `UPPER(TRIM(COALESCE(${c}, ''))) = 'DV'`).join(' OR ')})`
const ehNotaDV = (n) =>
  CAMPOS_DV.some(
    (c) =>
      String(n[c] ?? '')
        .trim()
        .toUpperCase() === 'DV'
  )

const n = (v) => Number(v) || 0
const arred = (v) => Math.round(v * 100) / 100

function dataISO(v) {
  if (!v) return null
  if (v instanceof Date) {
    const y = v.getFullYear()
    const m = String(v.getMonth() + 1).padStart(2, '0')
    const d = String(v.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return String(v).slice(0, 10)
}

function hojeISO() {
  return dataISO(new Date())
}

function diasEntre(deISO, ateISO) {
  const a = new Date(deISO + 'T00:00:00')
  const b = new Date(ateISO + 'T00:00:00')
  return Math.round((b - a) / 86400000)
}

function chavePeriodo(ano, mes) {
  return n(ano) * 12 + n(mes)
}

function periodoDaData(iso) {
  const [ano, mes] = String(iso).split('-').map(Number)
  return { ano, mes, chave: chavePeriodo(ano, mes) }
}

function classificarImportacao(i, pagamentos) {
  const valorMoeda = n(i.valor_moeda)
  const taxa = n(i.taxa_cambio)
  let pagoMoeda = 0
  let pagoReais = 0
  for (const p of pagamentos) {
    const reais = n(p.valor_reais)
    let moeda = n(p.valor_moeda)
    if (!moeda && reais > 0 && taxa > 0) moeda = reais / taxa
    pagoMoeda += moeda
    pagoReais += reais
  }
  pagoMoeda = arred(pagoMoeda)
  pagoReais = arred(pagoReais)
  const saldoMoeda = arred(valorMoeda - pagoMoeda)

  let status = 'EM_ABERTO'
  if (valorMoeda > 0 && saldoMoeda < -0.01) status = 'PAGO_A_MAIOR'
  else if (valorMoeda > 0 && Math.abs(saldoMoeda) <= 0.01) status = 'QUITADA'
  else if (pagoMoeda > 0.01) status = 'PARCIAL'

  const vencimento = dataISO(i.data_vencimento)
  let prazo = 'SEM_VENCIMENTO'
  let diasParaVencer = null
  if (status === 'QUITADA' || status === 'PAGO_A_MAIOR') prazo = 'ENCERRADA'
  else if (vencimento) {
    diasParaVencer = diasEntre(hojeISO(), vencimento)
    if (diasParaVencer < 0) prazo = 'VENCIDA'
    else if (diasParaVencer <= DIAS_ALERTA_VENCIMENTO) prazo = 'VENCE_EM_BREVE'
    else prazo = 'EM_DIA'
  }

  const valorReaisInvoice = n(i.valor_reais) || arred(valorMoeda * taxa)
  const variacaoCambial = taxa > 0 ? arred(pagoReais - pagoMoeda * taxa) : 0

  return {
    ...i,
    data_invoice: dataISO(i.data_invoice),
    data_vencimento: vencimento,
    data_chegada: dataISO(i.data_chegada),
    pago_moeda: pagoMoeda,
    pago: pagoReais,
    saldo_moeda: saldoMoeda,
    saldo: arred(Math.max(saldoMoeda, 0) * taxa),
    valor_reais: valorReaisInvoice,
    percentual_pago: valorMoeda > 0 ? Math.min(100, arred((pagoMoeda / valorMoeda) * 100)) : 0,
    variacao_cambial: variacaoCambial,
    status,
    prazo,
    dias_para_vencer: diasParaVencer,
    qtd_pagamentos: pagamentos.length
  }
}

async function importacoesComputadas() {
  const [imps] = await banco.query(`
    SELECT i.*, f.nome AS fornecedor_nome, f.pais AS fornecedor_pais
    FROM fin_importacoes i LEFT JOIN fin_fornecedores f ON f.id = i.fornecedor_id
    ORDER BY i.data_invoice DESC, i.id DESC`)
  const [pgs] = await banco.query('SELECT importacao_id, valor_reais, valor_moeda FROM fin_pagamentos')
  const porImp = {}
  pgs.forEach((p) => {
    ;(porImp[p.importacao_id] = porImp[p.importacao_id] || []).push(p)
  })
  return imps.map((i) => classificarImportacao(i, porImp[i.id] || []))
}

async function garantirMes(ano, mes) {
  const [[ex]] = await banco.query('SELECT id FROM ec_meses WHERE ano = ? AND mes = ?', [ano, mes])
  if (ex) return ex.id
  const [r] = await banco.query('INSERT INTO ec_meses (ano, mes, nome) VALUES (?, ?, ?)', [
    ano,
    mes,
    `${NOMES_MESES[mes]} ${ano}`
  ])
  return r.insertId
}

async function garantirMesesAteHoje() {
  const hoje = new Date()
  const chaveHoje = chavePeriodo(hoje.getFullYear(), hoje.getMonth() + 1)
  const [[min]] = await banco.query('SELECT MIN(ano * 12 + mes) AS c FROM ec_meses')
  const [[minNf]] = await banco.query('SELECT MIN(ano * 12 + mes) AS c FROM nfe_lancamentos WHERE entra_fechamento = 1')
  const [[minPg]] = await banco.query(
    'SELECT MIN(YEAR(data_pgto) * 12 + MONTH(data_pgto)) AS c FROM fin_pagamentos WHERE entra_fechamento = 1 AND data_pgto IS NOT NULL'
  )
  const candidatos = [min && min.c, minNf && minNf.c, minPg && minPg.c, chaveHoje].filter((c) => c)
  const inicio = Math.min(...candidatos.map(Number))
  const [existentes] = await banco.query('SELECT ano * 12 + mes AS c FROM ec_meses')
  const tem = new Set(existentes.map((e) => Number(e.c)))
  for (let c = inicio; c <= chaveHoje; c++) {
    if (tem.has(c)) continue
    const ano = Math.floor((c - 1) / 12)
    const mes = c - ano * 12
    await garantirMes(ano, mes)
  }
}

const MODULOS_EC = {
  exterior: {
    tabela: 'ec_lanc_exterior',
    col: 'cliente_id',
    ent: 'ec_clientes',
    aumenta: 'debito',
    diminui: 'baixa',
    temFatura: true
  },
  adiant_clientes: {
    tabela: 'ec_lanc_adiant_clientes',
    col: 'cliente_id',
    ent: 'ec_clientes',
    aumenta: 'credito',
    diminui: 'debito',
    temFatura: false
  },
  adiant_fornecedores: {
    tabela: 'ec_lanc_adiant_fornecedores',
    col: 'fornecedor_id',
    ent: 'fin_fornecedores',
    aumenta: 'debito',
    diminui: 'pagamento',
    temFatura: false
  }
}

async function lancamentosAutomaticos(modulo) {
  if (modulo === 'exterior') {
    const [rows] = await banco.query(`
      SELECT id, cliente_id, data, ano, mes, nf, fatura, valor_nfe
      FROM nfe_lancamentos WHERE cliente_id IS NOT NULL AND entra_fechamento = 1 AND ${SQL_NAO_DV}`)
    return rows.map((r) => {
      const data = dataISO(r.data)
      return {
        id: 'nf-' + r.id,
        entidade_id: r.cliente_id,
        chave: data ? periodoDaData(data).chave : chavePeriodo(r.ano, r.mes),
        data_lanc: data,
        tipo: 'debito',
        valor: n(r.valor_nfe),
        fatura: r.fatura,
        observacao: `NF-e ${r.nf || '-'} (Faturamento)`,
        automatico: true
      }
    })
  }
  if (modulo === 'adiant_fornecedores') {
    const [rows] = await banco.query(`
      SELECT p.id, p.data_pgto, p.valor_reais, i.id AS imp_id, i.invoice, i.fornecedor_id, i.data_chegada
      FROM fin_pagamentos p JOIN fin_importacoes i ON i.id = p.importacao_id
      WHERE p.entra_fechamento = 1 AND p.data_pgto IS NOT NULL AND i.fornecedor_id IS NOT NULL`)
    const eventos = []
    const baixas = {}
    for (const r of rows) {
      const pgto = dataISO(r.data_pgto)
      const chegada = dataISO(r.data_chegada)
      if (chegada && pgto >= chegada) continue
      eventos.push({
        id: 'pg-' + r.id,
        entidade_id: r.fornecedor_id,
        chave: periodoDaData(pgto).chave,
        data_lanc: pgto,
        tipo: 'debito',
        valor: n(r.valor_reais),
        observacao: `Pagamento antecipado · invoice ${r.invoice}`,
        automatico: true
      })
      if (chegada) {
        if (!baixas[r.imp_id])
          baixas[r.imp_id] = { fornecedor_id: r.fornecedor_id, chegada, invoice: r.invoice, valor: 0 }
        baixas[r.imp_id].valor += n(r.valor_reais)
      }
    }
    for (const [impId, b] of Object.entries(baixas)) {
      eventos.push({
        id: 'ch-' + impId,
        entidade_id: b.fornecedor_id,
        chave: periodoDaData(b.chegada).chave,
        data_lanc: b.chegada,
        tipo: 'pagamento',
        valor: arred(b.valor),
        observacao: `Chegada da mercadoria · invoice ${b.invoice}`,
        automatico: true
      })
    }
    return eventos
  }
  return []
}

async function lancamentosManuais(modulo) {
  const cfg = MODULOS_EC[modulo]
  const [rows] = await banco.query(`SELECT l.*, m.ano, m.mes FROM ${cfg.tabela} l JOIN ec_meses m ON m.id = l.mes_id`)
  return rows.map((r) => ({
    ...r,
    entidade_id: r[cfg.col],
    chave: chavePeriodo(r.ano, r.mes),
    data_lanc: dataISO(r.data_lanc),
    valor: n(r.valor),
    automatico: false
  }))
}

async function todosLancamentos(modulo) {
  const [manuais, automaticos] = await Promise.all([lancamentosManuais(modulo), lancamentosAutomaticos(modulo)])
  return manuais.concat(automaticos)
}

async function saldosDoPeriodo(modulo, ano, mes) {
  const cfg = MODULOS_EC[modulo]
  const chave = chavePeriodo(ano, mes)
  const [entidades] = await banco.query(`SELECT * FROM ${cfg.ent} ORDER BY nome`)
  const lancs = await todosLancamentos(modulo)
  const acum = {}
  for (const l of lancs) {
    if (l.chave > chave) continue
    const a = (acum[l.entidade_id] = acum[l.entidade_id] || { anterior: 0, aumenta: 0, diminui: 0, auto: 0 })
    const sinal = l.tipo === cfg.aumenta ? 1 : l.tipo === cfg.diminui ? -1 : 0
    if (l.chave < chave) a.anterior += sinal * l.valor
    else if (sinal > 0) a.aumenta += l.valor
    else if (sinal < 0) a.diminui += l.valor
    if (l.chave === chave && l.automatico) a.auto++
  }
  const linhas = []
  for (const ent of entidades) {
    const a = acum[ent.id] || { anterior: 0, aumenta: 0, diminui: 0, auto: 0 }
    const atual = arred(a.anterior + a.aumenta - a.diminui)
    const temMovimento = Math.abs(a.anterior) > 0.009 || a.aumenta > 0.009 || a.diminui > 0.009
    if (ent.ativo === 0 && !temMovimento) continue
    linhas.push({
      id: ent.id,
      nome: ent.nome,
      pais: ent.pais || '',
      ativo: ent.ativo !== 0,
      anterior: arred(a.anterior),
      aumenta: arred(a.aumenta),
      diminui: arred(a.diminui),
      atual,
      automaticos: a.auto
    })
  }
  return { temFatura: cfg.temFatura, linhas }
}

async function lancamentosDaEntidade(modulo, ano, mes, entidadeId) {
  const chave = chavePeriodo(ano, mes)
  const lancs = await todosLancamentos(modulo)
  return lancs
    .filter((l) => l.chave === chave && String(l.entidade_id) === String(entidadeId))
    .sort((a, b) => String(a.data_lanc || '').localeCompare(String(b.data_lanc || '')))
}

module.exports = {
  NOMES_MESES,
  ehNotaDV,
  MODULOS_EC,
  DIAS_ALERTA_VENCIMENTO,
  dataISO,
  hojeISO,
  chavePeriodo,
  importacoesComputadas,
  garantirMes,
  garantirMesesAteHoje,
  saldosDoPeriodo,
  lancamentosDaEntidade
}
