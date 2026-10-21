const express = require('express')
const { banco, emTransacao } = require('../config/banco')
const { autenticarContabil } = require('../middlewares/autenticacao')
const { enviarResumoSemanalImportacao, importacoesComputadas } = require('../servicos/resumo-importacoes')

const rotas = express.Router()

async function migrarFinanceiro() {
  try {
    const [cols] = await banco.query("SHOW COLUMNS FROM fin_pagamentos LIKE 'contrato_id'")
    if (!cols.length) {
      await banco.query('ALTER TABLE fin_pagamentos ADD COLUMN contrato_id INT NULL')
      console.log('fin_pagamentos.contrato_id adicionado.')
    }
    const [[flag]] = await banco.query("SELECT chave FROM notif_log WHERE chave = 'backfill_pag_usd'")
    if (!flag) {
      await banco.query('CREATE TABLE IF NOT EXISTS notif_log (chave VARCHAR(60) PRIMARY KEY, ultima_data DATE)')
      const [r] = await banco.query(`
        UPDATE fin_pagamentos p JOIN fin_importacoes i ON i.id = p.importacao_id
        SET p.valor_moeda = ROUND(p.valor_reais / i.taxa_cambio, 2)
        WHERE (p.valor_moeda IS NULL OR p.valor_moeda = 0) AND i.taxa_cambio > 0 AND p.valor_reais > 0`)
      await banco.query(
        "INSERT INTO notif_log (chave, ultima_data) VALUES ('backfill_pag_usd', CURDATE()) ON DUPLICATE KEY UPDATE ultima_data = CURDATE()"
      )
      console.log('Backfill USD dos pagamentos:', r.affectedRows, 'linhas.')
    }
    try {
      const [uc] = await banco.query("SHOW COLUMNS FROM fin_custos LIKE 'unidade'")
      if (!uc.length) await banco.query("ALTER TABLE fin_custos ADD COLUMN unidade VARCHAR(4) DEFAULT 'KG'")
      const [pc] = await banco.query("SHOW COLUMNS FROM fin_custos LIKE 'produto'")
      if (!pc.length) await banco.query('ALTER TABLE fin_custos ADD COLUMN produto VARCHAR(200)')
    } catch (e) {}
  } catch (e) {
    console.error('Erro migração financeiro:', e.message)
  }
}

setTimeout(migrarFinanceiro, 7000)

rotas.post('/api/fin/resumo-semanal/enviar', autenticarContabil(), async (req, res) => {
  await enviarResumoSemanalImportacao(true)
  res.json({ ok: true })
})

rotas.get('/api/fin/resumo', autenticarContabil(), async (req, res) => {
  const imps = await importacoesComputadas()
  const totalImportado = imps.reduce((s, i) => s + (Number(i.valor_reais) || 0), 0)
  const totalPago = imps.reduce((s, i) => s + i.pago, 0)
  const cont = { PAGO: 0, PARCIAL: 0, DEVENDO: 0 }
  const porForn = {}
  imps.forEach((i) => {
    cont[i.status]++
    const k = i.fornecedor_nome || '—'
    if (!porForn[k]) porForn[k] = { fornecedor: k, importado: 0, pago: 0, saldo: 0 }
    porForn[k].importado += Number(i.valor_reais) || 0
    porForn[k].pago += i.pago
    porForn[k].saldo += i.saldo
  })
  res.json({
    totalImportado,
    totalPago,
    saldoDevedor: totalImportado - totalPago,
    qtd: imps.length,
    contagem: cont,
    porFornecedor: Object.values(porForn).sort((a, b) => b.saldo - a.saldo),
    importacoes: imps
  })
})

const cachePtax = {}

function formatarDataBcb(d) {
  const [y, m, dd] = d.split('-')
  return `${m}-${dd}-${y}`
}

rotas.get('/api/fin/ptax', autenticarContabil(), async (req, res) => {
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

rotas.get('/api/fin/fornecedores', autenticarContabil(), async (req, res) => {
  const [rows] = await banco.query('SELECT * FROM fin_fornecedores ORDER BY nome')
  res.json(rows)
})

rotas.post('/api/fin/fornecedores', autenticarContabil(), async (req, res) => {
  const b = req.body
  if (!(b.nome || '').trim()) return res.status(400).json({ erro: 'Informe o nome.' })
  await banco.query('INSERT INTO fin_fornecedores (nome, pais, moeda, contato, email, obs) VALUES (?,?,?,?,?,?)', [
    b.nome.trim(),
    b.pais || null,
    b.moeda || 'USD',
    b.contato || null,
    b.email || null,
    b.obs || null
  ])
  res.json({ ok: true })
})

rotas.patch('/api/fin/fornecedores/:id', autenticarContabil(), async (req, res) => {
  const campos = ['nome', 'pais', 'moeda', 'contato', 'email', 'obs', 'ativo']
  const sets = [],
    vals = []
  for (const c of campos) {
    if (c in req.body) {
      sets.push(`${c} = ?`)
      vals.push(req.body[c] === '' ? null : req.body[c])
    }
  }
  if (!sets.length) return res.json({ ok: true })
  vals.push(req.params.id)
  await banco.query(`UPDATE fin_fornecedores SET ${sets.join(', ')} WHERE id = ?`, vals)
  res.json({ ok: true })
})

rotas.delete('/api/fin/fornecedores/:id', autenticarContabil(), async (req, res) => {
  await banco.query('DELETE FROM fin_fornecedores WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

const CAMPOS_IMPORTACAO = [
  'fornecedor_id',
  'invoice',
  'data_invoice',
  'mercadoria',
  'moeda',
  'valor_moeda',
  'taxa_cambio',
  'banco',
  'obs'
]

function calcularValorReais(b) {
  return (parseFloat(b.valor_moeda) || 0) * (parseFloat(b.taxa_cambio) || 0)
}

rotas.post('/api/fin/importacoes', autenticarContabil(), async (req, res) => {
  const b = req.body
  if (!b.invoice) return res.status(400).json({ erro: 'Informe o Nº do invoice.' })
  const valorReais = calcularValorReais(b)
  await banco.query(
    `INSERT INTO fin_importacoes (fornecedor_id, invoice, data_invoice, mercadoria, moeda, valor_moeda, taxa_cambio, valor_reais, banco, obs)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      b.fornecedor_id || null,
      b.invoice,
      b.data_invoice || null,
      b.mercadoria || null,
      b.moeda || 'USD',
      parseFloat(b.valor_moeda) || 0,
      parseFloat(b.taxa_cambio) || 0,
      valorReais,
      b.banco || null,
      b.obs || null
    ]
  )
  res.json({ ok: true })
})

rotas.patch('/api/fin/importacoes/:id', autenticarContabil(), async (req, res) => {
  const sets = [],
    vals = []
  for (const c of CAMPOS_IMPORTACAO) {
    if (c in req.body) {
      let v = req.body[c]
      if (v === '') v = null
      if (c === 'valor_moeda' || c === 'taxa_cambio') v = parseFloat(v) || 0
      sets.push(`${c} = ?`)
      vals.push(v)
    }
  }
  if ('valor_moeda' in req.body || 'taxa_cambio' in req.body) {
    sets.push('valor_reais = ?')
    vals.push(calcularValorReais(req.body))
  }
  if (!sets.length) return res.json({ ok: true })
  vals.push(req.params.id)
  await banco.query(`UPDATE fin_importacoes SET ${sets.join(', ')} WHERE id = ?`, vals)
  res.json({ ok: true })
})

rotas.delete('/api/fin/importacoes/:id', autenticarContabil(), async (req, res) => {
  await emTransacao(async (conexao) => {
    await conexao.query('DELETE FROM fin_pagamentos WHERE importacao_id = ?', [req.params.id])
    await conexao.query('DELETE FROM fin_contratos WHERE importacao_id = ?', [req.params.id])
    await conexao.query('DELETE FROM fin_importacoes WHERE id = ?', [req.params.id])
  })
  res.json({ ok: true })
})

rotas.get('/api/fin/pagamentos', autenticarContabil(), async (req, res) => {
  const [rows] = await banco.query('SELECT * FROM fin_pagamentos WHERE importacao_id = ? ORDER BY data_pgto, id', [
    parseInt(req.query.importacaoId) || 0
  ])
  res.json(rows)
})

rotas.post('/api/fin/pagamentos', autenticarContabil(), async (req, res) => {
  const b = req.body
  if (!b.importacao_id || !(parseFloat(b.valor_reais) >= 0)) return res.status(400).json({ erro: 'Dados inválidos.' })
  await banco.query(
    'INSERT INTO fin_pagamentos (importacao_id, data_pgto, valor_reais, valor_moeda, forma, obs, contrato_id) VALUES (?,?,?,?,?,?,?)',
    [
      b.importacao_id,
      b.data_pgto || null,
      parseFloat(b.valor_reais) || 0,
      parseFloat(b.valor_moeda) || 0,
      b.forma || null,
      b.obs || null,
      b.contrato_id || null
    ]
  )
  res.json({ ok: true })
})

rotas.patch('/api/fin/pagamentos/:id', autenticarContabil(), async (req, res) => {
  const campos = ['data_pgto', 'valor_reais', 'valor_moeda', 'forma', 'obs', 'contrato_id']
  const sets = [],
    vals = []
  for (const c of campos) {
    if (c in req.body) {
      let v = req.body[c]
      if (v === '') v = null
      if (c === 'valor_reais' || c === 'valor_moeda') v = parseFloat(v) || 0
      sets.push(`${c} = ?`)
      vals.push(v)
    }
  }
  if (!sets.length) return res.json({ ok: true })
  vals.push(req.params.id)
  await banco.query(`UPDATE fin_pagamentos SET ${sets.join(', ')} WHERE id = ?`, vals)
  res.json({ ok: true })
})

rotas.delete('/api/fin/pagamentos/:id', autenticarContabil(), async (req, res) => {
  await banco.query('DELETE FROM fin_pagamentos WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

rotas.get('/api/fin/contratos', autenticarContabil(), async (req, res) => {
  const cond = req.query.importacaoId ? 'WHERE c.importacao_id = ?' : ''
  const args = req.query.importacaoId ? [parseInt(req.query.importacaoId)] : []
  const [rows] = await banco.query(
    `
    SELECT c.*, i.invoice FROM fin_contratos c LEFT JOIN fin_importacoes i ON i.id = c.importacao_id
    ${cond} ORDER BY c.data_fechamento DESC, c.id DESC`,
    args
  )
  res.json(rows)
})

rotas.post('/api/fin/contratos', autenticarContabil(), async (req, res) => {
  const b = req.body
  if (!b.num_contrato) return res.status(400).json({ erro: 'Informe o Nº do contrato.' })
  await banco.query(
    `INSERT INTO fin_contratos (num_contrato, banco, data_fechamento, moeda, valor_moeda, taxa, valor_reais, importacao_id, liquidado, data_liquidacao, obs)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      b.num_contrato,
      b.banco || null,
      b.data_fechamento || null,
      b.moeda || 'USD',
      parseFloat(b.valor_moeda) || 0,
      parseFloat(b.taxa) || 0,
      (parseFloat(b.valor_moeda) || 0) * (parseFloat(b.taxa) || 0),
      b.importacao_id || null,
      b.liquidado ? 1 : 0,
      b.data_liquidacao || null,
      b.obs || null
    ]
  )
  res.json({ ok: true })
})

rotas.patch('/api/fin/contratos/:id', autenticarContabil(), async (req, res) => {
  const b = req.body
  const campos = [
    'num_contrato',
    'banco',
    'data_fechamento',
    'moeda',
    'valor_moeda',
    'taxa',
    'importacao_id',
    'liquidado',
    'data_liquidacao',
    'obs'
  ]
  const sets = [],
    vals = []
  for (const c of campos) {
    if (c in b) {
      let v = b[c]
      if (v === '') v = null
      if (c === 'valor_moeda' || c === 'taxa') v = parseFloat(v) || 0
      if (c === 'liquidado') v = b[c] ? 1 : 0
      sets.push(`${c} = ?`)
      vals.push(v)
    }
  }
  if ('valor_moeda' in b || 'taxa' in b) {
    sets.push('valor_reais = ?')
    vals.push((parseFloat(b.valor_moeda) || 0) * (parseFloat(b.taxa) || 0))
  }
  if (!sets.length) return res.json({ ok: true })
  vals.push(req.params.id)
  await banco.query(`UPDATE fin_contratos SET ${sets.join(', ')} WHERE id = ?`, vals)
  res.json({ ok: true })
})

rotas.delete('/api/fin/contratos/:id', autenticarContabil(), async (req, res) => {
  await banco.query('DELETE FROM fin_contratos WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

module.exports = rotas
