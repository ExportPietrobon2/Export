const express = require('express')
const { banco, emTransacao } = require('../config/banco')
const { autenticar } = require('../middlewares/autenticacao')
const { enviarResumoSemanalImportacao } = require('../servicos/resumo-importacoes')
const { importacoesComputadas } = require('../servicos/financeiro')

const rotas = express.Router()

const vazioParaNulo = (v) => (v === '' || v === undefined ? null : v)
const numero = (v) => parseFloat(String(v ?? '').replace(',', '.')) || 0

rotas.post('/api/fin/resumo-semanal/enviar', autenticar(), async (req, res) => {
  await enviarResumoSemanalImportacao(true)
  res.json({ ok: true })
})

rotas.get('/api/fin/resumo', autenticar(), async (req, res) => {
  const imps = await importacoesComputadas()
  const contagem = { EM_ABERTO: 0, PARCIAL: 0, QUITADA: 0, PAGO_A_MAIOR: 0, VENCIDA: 0, VENCE_EM_BREVE: 0 }
  imps.forEach((i) => {
    contagem[i.status]++
    if (i.prazo === 'VENCIDA') contagem.VENCIDA++
    if (i.prazo === 'VENCE_EM_BREVE') contagem.VENCE_EM_BREVE++
  })
  res.json({ contagem, importacoes: imps })
})

const cachePtax = {}

function formatarDataBcb(d) {
  const [y, m, dd] = d.split('-')
  return `${m}-${dd}-${y}`
}

rotas.get('/api/fin/ptax', autenticar(), async (req, res) => {
  const data = String(req.query.data || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return res.status(400).json({ erro: 'Data inválida.' })
  if (cachePtax[data]) return res.json(cachePtax[data])
  try {
    const ini = new Date(data + 'T00:00:00')
    ini.setDate(ini.getDate() - 12)
    const iniStr = ini.toISOString().slice(0, 10)
    const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@dataInicial='${formatarDataBcb(iniStr)}'&@dataFinalCotacao='${formatarDataBcb(data)}'&$top=100&$orderby=dataHoraCotacao%20desc&$format=json`
    const resposta = await fetch(url)
    if (!resposta.ok) return res.status(502).json({ erro: 'Banco Central indisponível.' })
    const j = await resposta.json()
    const arr = (j && j.value) || []
    if (!arr.length) return res.json({ taxa: null, dataCotacao: null, aviso: 'Sem cotação no período.' })
    const c = arr[0]
    const out = { taxa: c.cotacaoVenda, dataCotacao: String(c.dataHoraCotacao || '').slice(0, 10) }
    cachePtax[data] = out
    res.json(out)
  } catch (e) {
    console.error('Erro PTAX:', e.message)
    res.status(502).json({ erro: 'Falha ao consultar PTAX.' })
  }
})

const CAMPOS_IMPORTACAO = [
  'fornecedor_id',
  'invoice',
  'data_invoice',
  'data_vencimento',
  'data_chegada',
  'mercadoria',
  'moeda',
  'valor_moeda',
  'taxa_cambio',
  'banco',
  'obs'
]

function valoresImportacao(b) {
  const valorMoeda = numero(b.valor_moeda)
  const taxa = numero(b.taxa_cambio)
  return {
    fornecedor_id: vazioParaNulo(b.fornecedor_id),
    invoice: String(b.invoice || '').trim(),
    data_invoice: vazioParaNulo(b.data_invoice),
    data_vencimento: vazioParaNulo(b.data_vencimento),
    data_chegada: vazioParaNulo(b.data_chegada),
    mercadoria: vazioParaNulo(b.mercadoria),
    moeda: b.moeda || 'USD',
    valor_moeda: valorMoeda,
    taxa_cambio: taxa,
    valor_reais: Math.round(valorMoeda * taxa * 100) / 100,
    banco: vazioParaNulo(b.banco),
    obs: vazioParaNulo(b.obs)
  }
}

rotas.post('/api/fin/importacoes', autenticar(), async (req, res) => {
  const v = valoresImportacao(req.body || {})
  if (!v.invoice) return res.status(400).json({ erro: 'Informe o Nº da invoice.' })
  if (!(v.valor_moeda > 0)) return res.status(400).json({ erro: 'Informe o valor da invoice.' })
  const [[dup]] = await banco.query('SELECT id FROM fin_importacoes WHERE invoice = ? AND fornecedor_id <=> ?', [
    v.invoice,
    v.fornecedor_id
  ])
  if (dup) return res.status(400).json({ erro: 'Já existe uma importação com esta invoice para este fornecedor.' })
  const colunas = Object.keys(v)
  const [r] = await banco.query(
    `INSERT INTO fin_importacoes (${colunas.join(', ')}) VALUES (${colunas.map(() => '?').join(', ')})`,
    Object.values(v)
  )
  res.json({ ok: true, id: r.insertId })
})

rotas.patch('/api/fin/importacoes/:id', autenticar(), async (req, res) => {
  const [[atual]] = await banco.query('SELECT * FROM fin_importacoes WHERE id = ?', [req.params.id])
  if (!atual) return res.status(404).json({ erro: 'Importação não encontrada.' })
  const mesclado = { ...atual }
  for (const c of CAMPOS_IMPORTACAO) if (c in req.body) mesclado[c] = req.body[c]
  const v = valoresImportacao(mesclado)
  if (!v.invoice) return res.status(400).json({ erro: 'Informe o Nº da invoice.' })
  await banco.query(
    `UPDATE fin_importacoes SET ${Object.keys(v)
      .map((c) => `${c} = ?`)
      .join(', ')} WHERE id = ?`,
    [...Object.values(v), req.params.id]
  )
  res.json({ ok: true })
})

rotas.delete('/api/fin/importacoes/:id', autenticar(), async (req, res) => {
  await emTransacao(async (conexao) => {
    const [custos] = await conexao.query('SELECT id FROM fin_custos WHERE importacao_id = ?', [req.params.id])
    for (const c of custos) {
      await conexao.query('DELETE FROM fin_custo_despesas WHERE custo_id = ?', [c.id])
      await conexao.query('DELETE FROM fin_custo_st WHERE custo_id = ?', [c.id])
    }
    await conexao.query('DELETE FROM fin_custos WHERE importacao_id = ?', [req.params.id])
    await conexao.query('DELETE FROM fin_pagamentos WHERE importacao_id = ?', [req.params.id])
    await conexao.query('DELETE FROM fin_contratos WHERE importacao_id = ?', [req.params.id])
    await conexao.query('DELETE FROM fin_importacoes WHERE id = ?', [req.params.id])
  })
  res.json({ ok: true })
})

rotas.get('/api/fin/pagamentos', autenticar(), async (req, res) => {
  const [rows] = await banco.query(
    `SELECT p.*, c.num_contrato FROM fin_pagamentos p LEFT JOIN fin_contratos c ON c.id = p.contrato_id
     WHERE p.importacao_id = ? ORDER BY p.data_pgto, p.id`,
    [parseInt(req.query.importacaoId) || 0]
  )
  res.json(rows)
})

function valoresPagamento(b) {
  return {
    data_pgto: vazioParaNulo(b.data_pgto),
    valor_reais: numero(b.valor_reais),
    valor_moeda: numero(b.valor_moeda),
    forma: vazioParaNulo(b.forma),
    obs: vazioParaNulo(b.obs),
    contrato_id: vazioParaNulo(b.contrato_id),
    entra_fechamento: b.entra_fechamento === undefined ? 1 : b.entra_fechamento ? 1 : 0
  }
}

rotas.post('/api/fin/pagamentos', autenticar(), async (req, res) => {
  const b = req.body || {}
  const v = valoresPagamento(b)
  if (!b.importacao_id) return res.status(400).json({ erro: 'Importação não informada.' })
  if (!v.data_pgto) return res.status(400).json({ erro: 'Informe a data do pagamento.' })
  if (!(v.valor_moeda > 0) && !(v.valor_reais > 0)) return res.status(400).json({ erro: 'Informe o valor pago.' })
  await banco.query(
    'INSERT INTO fin_pagamentos (importacao_id, data_pgto, valor_reais, valor_moeda, forma, obs, contrato_id, entra_fechamento) VALUES (?,?,?,?,?,?,?,?)',
    [b.importacao_id, v.data_pgto, v.valor_reais, v.valor_moeda, v.forma, v.obs, v.contrato_id, v.entra_fechamento]
  )
  res.json({ ok: true })
})

async function pagamentoDoContrato(id) {
  const [[p]] = await banco.query('SELECT origem FROM fin_pagamentos WHERE id = ?', [id])
  return p && p.origem === 'contrato'
}

rotas.patch('/api/fin/pagamentos/:id', autenticar(), async (req, res) => {
  if (await pagamentoDoContrato(req.params.id)) {
    if (Object.keys(req.body || {}).length === 1 && 'entra_fechamento' in req.body) {
      await banco.query('UPDATE fin_pagamentos SET entra_fechamento = ? WHERE id = ?', [
        req.body.entra_fechamento ? 1 : 0,
        req.params.id
      ])
      return res.json({ ok: true })
    }
    return res.status(400).json({ erro: 'Este pagamento foi gerado pelo contrato de câmbio. Altere o contrato.' })
  }
  const sets = []
  const vals = []
  const v = valoresPagamento({ ...req.body, entra_fechamento: req.body.entra_fechamento ?? 1 })
  for (const c of Object.keys(v)) {
    if (c in req.body) {
      sets.push(`${c} = ?`)
      vals.push(v[c])
    }
  }
  if (!sets.length) return res.json({ ok: true })
  vals.push(req.params.id)
  await banco.query(`UPDATE fin_pagamentos SET ${sets.join(', ')} WHERE id = ?`, vals)
  res.json({ ok: true })
})

rotas.delete('/api/fin/pagamentos/:id', autenticar(), async (req, res) => {
  if (await pagamentoDoContrato(req.params.id)) {
    return res
      .status(400)
      .json({ erro: 'Este pagamento foi gerado pelo contrato de câmbio. Desmarque "liquidado" no contrato.' })
  }
  await banco.query('DELETE FROM fin_pagamentos WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

async function sincronizarPagamentoDoContrato(conexao, contratoId, podeCriar) {
  const [[c]] = await conexao.query('SELECT * FROM fin_contratos WHERE id = ?', [contratoId])
  const [[auto]] = await conexao.query("SELECT id FROM fin_pagamentos WHERE contrato_id = ? AND origem = 'contrato'", [
    contratoId
  ])
  const deveExistir = c && c.liquidado && c.importacao_id
  if (!deveExistir) {
    if (auto) await conexao.query('DELETE FROM fin_pagamentos WHERE id = ?', [auto.id])
    return null
  }
  const [[manual]] = await conexao.query(
    "SELECT id FROM fin_pagamentos WHERE contrato_id = ? AND (origem IS NULL OR origem <> 'contrato')",
    [contratoId]
  )
  if (manual) {
    if (auto) await conexao.query('DELETE FROM fin_pagamentos WHERE id = ?', [auto.id])
    return 'manual'
  }
  const valores = [
    c.importacao_id,
    c.data_liquidacao || c.data_fechamento || new Date(),
    Number(c.valor_reais) || 0,
    Number(c.valor_moeda) || 0,
    'Contrato de câmbio',
    `Contrato Nº ${c.num_contrato}`
  ]
  if (!auto && !podeCriar) return null
  if (auto) {
    await conexao.query(
      'UPDATE fin_pagamentos SET importacao_id = ?, data_pgto = ?, valor_reais = ?, valor_moeda = ?, forma = ?, obs = ? WHERE id = ?',
      [...valores, auto.id]
    )
  } else {
    await conexao.query(
      "INSERT INTO fin_pagamentos (importacao_id, data_pgto, valor_reais, valor_moeda, forma, obs, contrato_id, origem, entra_fechamento) VALUES (?,?,?,?,?,?,?,'contrato',1)",
      [...valores, contratoId]
    )
  }
  return 'automatico'
}

rotas.get('/api/fin/contratos', autenticar(), async (req, res) => {
  const cond = req.query.importacaoId ? 'WHERE c.importacao_id = ?' : ''
  const args = req.query.importacaoId ? [parseInt(req.query.importacaoId)] : []
  const [rows] = await banco.query(
    `SELECT c.*, i.invoice, f.nome AS fornecedor_nome,
       (SELECT COUNT(*) FROM fin_pagamentos p WHERE p.contrato_id = c.id) AS qtd_pagamentos
     FROM fin_contratos c
     LEFT JOIN fin_importacoes i ON i.id = c.importacao_id
     LEFT JOIN fin_fornecedores f ON f.id = i.fornecedor_id
     ${cond} ORDER BY c.liquidado ASC, c.data_fechamento DESC, c.id DESC`,
    args
  )
  res.json(rows)
})

function valoresContrato(b) {
  const valorMoeda = numero(b.valor_moeda)
  const taxa = numero(b.taxa)
  return {
    num_contrato: String(b.num_contrato || '').trim(),
    banco: vazioParaNulo(b.banco),
    data_fechamento: vazioParaNulo(b.data_fechamento),
    moeda: b.moeda || 'USD',
    valor_moeda: valorMoeda,
    taxa,
    valor_reais: Math.round(valorMoeda * taxa * 100) / 100,
    importacao_id: vazioParaNulo(b.importacao_id),
    liquidado: b.liquidado ? 1 : 0,
    data_liquidacao: vazioParaNulo(b.data_liquidacao),
    obs: vazioParaNulo(b.obs)
  }
}

rotas.post('/api/fin/contratos', autenticar(), async (req, res) => {
  const v = valoresContrato(req.body || {})
  if (!v.num_contrato) return res.status(400).json({ erro: 'Informe o Nº do contrato.' })
  if (v.liquidado && !v.data_liquidacao) v.data_liquidacao = v.data_fechamento
  const resultado = await emTransacao(async (conexao) => {
    const colunas = Object.keys(v)
    const [r] = await conexao.query(
      `INSERT INTO fin_contratos (${colunas.join(', ')}) VALUES (${colunas.map(() => '?').join(', ')})`,
      Object.values(v)
    )
    return sincronizarPagamentoDoContrato(conexao, r.insertId, true)
  })
  res.json({ ok: true, pagamento: resultado })
})

rotas.patch('/api/fin/contratos/:id', autenticar(), async (req, res) => {
  const [[atual]] = await banco.query('SELECT * FROM fin_contratos WHERE id = ?', [req.params.id])
  if (!atual) return res.status(404).json({ erro: 'Contrato não encontrado.' })
  const v = valoresContrato({ ...atual, ...req.body })
  if (!v.num_contrato) return res.status(400).json({ erro: 'Informe o Nº do contrato.' })
  if (v.liquidado && !v.data_liquidacao) v.data_liquidacao = v.data_fechamento
  const resultado = await emTransacao(async (conexao) => {
    await conexao.query(
      `UPDATE fin_contratos SET ${Object.keys(v)
        .map((c) => `${c} = ?`)
        .join(', ')} WHERE id = ?`,
      [...Object.values(v), req.params.id]
    )
    return sincronizarPagamentoDoContrato(conexao, req.params.id, !atual.liquidado)
  })
  res.json({ ok: true, pagamento: resultado })
})

rotas.delete('/api/fin/contratos/:id', autenticar(), async (req, res) => {
  await emTransacao(async (conexao) => {
    await conexao.query("DELETE FROM fin_pagamentos WHERE contrato_id = ? AND origem = 'contrato'", [req.params.id])
    await conexao.query('UPDATE fin_pagamentos SET contrato_id = NULL WHERE contrato_id = ?', [req.params.id])
    await conexao.query('DELETE FROM fin_contratos WHERE id = ?', [req.params.id])
  })
  res.json({ ok: true })
})

module.exports = rotas
