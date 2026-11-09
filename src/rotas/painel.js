const express = require('express')
const { autenticar } = require('../middlewares/autenticacao')
const { banco } = require('../config/banco')
const { importacoesComputadas, saldosDoPeriodo } = require('../servicos/financeiro')

const rotas = express.Router()

const somar = (lista, campo) => lista.reduce((s, x) => s + (Number(x[campo]) || 0), 0)

rotas.get('/api/fin/painel', autenticar(), async (req, res) => {
  const hoje = new Date()
  const ano = hoje.getFullYear()
  const mes = hoje.getMonth() + 1

  const imps = await importacoesComputadas()
  const abertas = imps.filter((i) => i.status === 'EM_ABERTO' || i.status === 'PARCIAL')
  const porMoeda = {}
  abertas.forEach((i) => {
    const m = i.moeda || 'USD'
    if (!porMoeda[m]) porMoeda[m] = { moeda: m, saldo: 0, qtd: 0 }
    porMoeda[m].saldo += Math.max(Number(i.saldo_moeda) || 0, 0)
    porMoeda[m].qtd++
  })
  const resumoImp = (i) => ({
    id: i.id,
    invoice: i.invoice,
    fornecedor_nome: i.fornecedor_nome,
    moeda: i.moeda,
    saldo_moeda: i.saldo_moeda,
    data_vencimento: i.data_vencimento,
    dias_para_vencer: i.dias_para_vencer,
    status: i.status,
    prazo: i.prazo
  })
  const vencidas = abertas.filter((i) => i.prazo === 'VENCIDA').sort((a, b) => a.dias_para_vencer - b.dias_para_vencer)
  const proximas = abertas
    .filter((i) => i.dias_para_vencer !== null && i.dias_para_vencer >= 0 && i.dias_para_vencer <= 30)
    .sort((a, b) => a.dias_para_vencer - b.dias_para_vencer)

  const [contratosAbertos] = await banco.query(
    'SELECT c.id, c.num_contrato, c.moeda, c.valor_moeda, c.data_fechamento, i.invoice FROM fin_contratos c LEFT JOIN fin_importacoes i ON i.id = c.importacao_id WHERE c.liquidado = 0 ORDER BY c.data_fechamento'
  )

  const [exterior, adiantClientes, adiantFornecedores] = await Promise.all([
    saldosDoPeriodo('exterior', ano, mes),
    saldosDoPeriodo('adiant_clientes', ano, mes),
    saldosDoPeriodo('adiant_fornecedores', ano, mes)
  ])
  const devedores = exterior.linhas
    .filter((l) => l.atual > 0.009)
    .sort((a, b) => b.atual - a.atual)
    .slice(0, 6)
    .map((l) => ({ id: l.id, nome: l.nome, pais: l.pais, saldo: l.atual }))

  const [notasAno] = await banco.query(
    'SELECT mes, valor_nfe, peso, cliente_id, num_due, data_due, num_conhecimento, data_conhecimento, tipo, vendedor FROM nfe_lancamentos WHERE ano = ?',
    [ano]
  )
  const porMes = Array.from({ length: 12 }, (_, k) => {
    const doMes = notasAno.filter((n) => n.mes === k + 1)
    return { mes: k + 1, valor: somar(doMes, 'valor_nfe'), qtd: doMes.length }
  })

  const pendencias = {
    importacoesSemVencimento: abertas.filter((i) => !i.data_vencimento).length,
    notasSemCliente: notasAno.filter((n) => !n.cliente_id).length,
    notasIncompletas: notasAno.filter(
      (n) =>
        !n.num_due || !n.data_due || !n.num_conhecimento || !n.data_conhecimento || !n.tipo || !n.vendedor || !n.peso
    ).length,
    contratosALiquidar: contratosAbertos.length,
    pagoAMaior: imps.filter((i) => i.status === 'PAGO_A_MAIOR').length
  }

  res.json({
    hoje: hoje.toISOString().slice(0, 10),
    importacoes: {
      porMoeda: Object.values(porMoeda),
      saldoReaisEstimado: somar(abertas, 'saldo'),
      qtdAbertas: abertas.length,
      qtdParciais: abertas.filter((i) => i.status === 'PARCIAL').length,
      vencidas: vencidas.map(resumoImp),
      proximas: proximas.map(resumoImp),
      variacaoCambialAno: imps
        .filter((i) => String(i.data_invoice || '').startsWith(String(ano)))
        .reduce((s, i) => s + (Number(i.variacao_cambial) || 0), 0)
    },
    contratosAbertos,
    clientes: {
      aReceber: somar(
        exterior.linhas.filter((l) => l.atual > 0),
        'atual'
      ),
      adiantamentos: somar(adiantClientes.linhas, 'atual'),
      devedores
    },
    fornecedores: { adiantamentos: somar(adiantFornecedores.linhas, 'atual') },
    faturamento: {
      ano,
      totalAno: somar(notasAno, 'valor_nfe'),
      pesoAno: somar(notasAno, 'peso'),
      mesAtual: porMes[mes - 1].valor,
      porMes
    },
    pendencias
  })
})

rotas.get('/api/pendencias', autenticar(), async (req, res) => {
  try {
    const [[t]] = await banco.query("SELECT COUNT(*) AS n FROM tarefas WHERE coluna <> 'concluido'")
    const imps = await importacoesComputadas()
    res.json({
      tarefasPendentes: Number(t.n) || 0,
      importacoesVencidas: imps.filter((i) => i.prazo === 'VENCIDA').length
    })
  } catch (e) {
    res.json({ tarefasPendentes: 0, importacoesVencidas: 0 })
  }
})

module.exports = rotas
