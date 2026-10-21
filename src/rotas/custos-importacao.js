const express = require('express')
const { banco, emTransacao } = require('../config/banco')
const { autenticarContabil } = require('../middlewares/autenticacao')

const rotas = express.Router()

async function inicializarCustos() {
  try {
    await banco.query(`CREATE TABLE IF NOT EXISTS fin_custos (
      id INT AUTO_INCREMENT PRIMARY KEY, importacao_id INT NULL, nfe VARCHAR(60), produto VARCHAR(200),
      mp_total DECIMAL(14,2) NULL, percentual DECIMAL(9,4) DEFAULT 100,
      materia_prima DECIMAL(14,2) DEFAULT 0, imposto_importacao DECIMAL(14,2) DEFAULT 0,
      ipi DECIMAL(14,2) DEFAULT 0, pis DECIMAL(14,2) DEFAULT 0, cofins DECIMAL(14,2) DEFAULT 0, icms DECIMAL(14,2) DEFAULT 0,
      quantidade_kg DECIMAL(14,3) DEFAULT 0, unidade VARCHAR(4) DEFAULT 'KG', obs VARCHAR(500),
      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_custos_imp (importacao_id))`)
    await banco.query(`CREATE TABLE IF NOT EXISTS fin_custo_despesas (
      id INT AUTO_INCREMENT PRIMARY KEY, custo_id INT NOT NULL, nome VARCHAR(160), valor DECIMAL(14,2) DEFAULT 0, INDEX(custo_id))`)
    await banco.query(`CREATE TABLE IF NOT EXISTS fin_custo_st (
      id INT AUTO_INCREMENT PRIMARY KEY, custo_id INT NOT NULL, produto VARCHAR(200), ncm VARCHAR(20),
      base_icms DECIMAL(14,2) DEFAULT 0, icms_proprio DECIMAL(14,2) DEFAULT 0, aliquota DECIMAL(6,4) DEFAULT 0,
      ipi_destacado DECIMAL(14,2) DEFAULT 0, mva DECIMAL(8,4) DEFAULT 0, INDEX(custo_id))`)

    const [cols] = await banco.query('SHOW COLUMNS FROM fin_custos')
    const nomes = cols.map((c) => c.Field)
    if (!nomes.includes('mp_total'))
      await banco.query('ALTER TABLE fin_custos ADD COLUMN mp_total DECIMAL(14,2) NULL AFTER produto')
    if (!nomes.includes('percentual'))
      await banco.query('ALTER TABLE fin_custos ADD COLUMN percentual DECIMAL(9,4) DEFAULT 100 AFTER mp_total')
    const [uniq] = await banco.query(
      "SHOW INDEX FROM fin_custos WHERE Column_name = 'importacao_id' AND Non_unique = 0"
    )
    for (const k of new Set(uniq.map((i) => i.Key_name))) {
      await banco.query(`ALTER TABLE fin_custos DROP INDEX \`${k}\``)
      console.log('fin_custos: removido índice único', k)
    }
    const [idx] = await banco.query("SHOW INDEX FROM fin_custos WHERE Column_name = 'importacao_id'")
    if (!idx.length) await banco.query('ALTER TABLE fin_custos ADD INDEX idx_custos_imp (importacao_id)')
  } catch (e) {
    console.error('Erro init custos:', e.message)
  }
}

setTimeout(inicializarCustos, 6000)

function stARecolher(it) {
  const bcSt = ((Number(it.base_icms) || 0) + (Number(it.ipi_destacado) || 0)) * (Number(it.mva) || 0)
  return bcSt * (Number(it.aliquota) || 0) - (Number(it.icms_proprio) || 0)
}

function computarCusto(cab, despesas, st) {
  const despTotal = (despesas || []).reduce((s, d) => s + (Number(d.valor) || 0), 0)
  const stCusto = (st || []).reduce((s, i) => s + stARecolher(i), 0)
  const mp = Number(cab.materia_prima) || 0
  const ii = Number(cab.imposto_importacao) || 0
  const ipi = Number(cab.ipi) || 0,
    pis = Number(cab.pis) || 0,
    cofins = Number(cab.cofins) || 0,
    icms = Number(cab.icms) || 0
  const total = mp + ii + stCusto + ipi + pis + cofins + icms + despTotal
  const credito = icms + ipi + pis + cofins
  const custoCredito = total - credito
  const kg = Number(cab.quantidade_kg) || 0
  return { despTotal, stCusto, total, credito, custoCredito, custoKg: kg > 0 ? custoCredito / kg : 0 }
}

function materiaPrimaProduto(b) {
  const tot = Number(b.mp_total)
  const pct = b.percentual === '' || b.percentual === undefined || b.percentual === null ? 100 : Number(b.percentual)
  if (tot > 0) return Math.round(((tot * pct) / 100) * 100) / 100
  return Number(b.materia_prima) || 0
}

async function custoCompleto(c) {
  const [despesas] = await banco.query('SELECT * FROM fin_custo_despesas WHERE custo_id = ? ORDER BY id', [c.id])
  const [st] = await banco.query('SELECT * FROM fin_custo_st WHERE custo_id = ? ORDER BY id', [c.id])
  return { ...c, despesas, st, calc: computarCusto(c, despesas, st) }
}

async function salvarFilhosCusto(custoId, b) {
  await banco.query('DELETE FROM fin_custo_despesas WHERE custo_id = ?', [custoId])
  for (const d of b.despesas || []) {
    if (!(d.nome || '').trim() && !(Number(d.valor) > 0)) continue
    await banco.query('INSERT INTO fin_custo_despesas (custo_id, nome, valor) VALUES (?,?,?)', [
      custoId,
      d.nome || null,
      Number(d.valor) || 0
    ])
  }
  await banco.query('DELETE FROM fin_custo_st WHERE custo_id = ?', [custoId])
  for (const s of b.st || []) {
    if (!(s.produto || '').trim() && !(Number(s.base_icms) > 0)) continue
    await banco.query(
      'INSERT INTO fin_custo_st (custo_id, produto, ncm, base_icms, icms_proprio, aliquota, ipi_destacado, mva) VALUES (?,?,?,?,?,?,?,?)',
      [
        custoId,
        s.produto || null,
        s.ncm || null,
        Number(s.base_icms) || 0,
        Number(s.icms_proprio) || 0,
        Number(s.aliquota) || 0,
        Number(s.ipi_destacado) || 0,
        Number(s.mva) || 0
      ]
    )
  }
}

function valoresCusto(b) {
  const pct =
    b.percentual === '' || b.percentual === undefined || b.percentual === null ? 100 : Number(b.percentual) || 0
  return [
    b.nfe || null,
    b.produto || null,
    Number(b.mp_total) > 0 ? Number(b.mp_total) : null,
    pct,
    materiaPrimaProduto(b),
    Number(b.imposto_importacao) || 0,
    Number(b.ipi) || 0,
    Number(b.pis) || 0,
    Number(b.cofins) || 0,
    Number(b.icms) || 0,
    Number(b.quantidade_kg) || 0,
    b.unidade || 'KG',
    b.obs || null
  ]
}

rotas.get('/api/fin/custos', autenticarContabil(), async (req, res) => {
  const [rows] = await banco.query(`
    SELECT c.*, i.invoice, f.nome AS fornecedor_nome
    FROM fin_custos c LEFT JOIN fin_importacoes i ON i.id = c.importacao_id LEFT JOIN fin_fornecedores f ON f.id = i.fornecedor_id
    ORDER BY c.atualizado_em DESC`)
  const [desp] = await banco.query('SELECT custo_id, valor FROM fin_custo_despesas')
  const [st] = await banco.query('SELECT * FROM fin_custo_st')
  const dMap = {},
    sMap = {}
  desp.forEach((d) => {
    ;(dMap[d.custo_id] = dMap[d.custo_id] || []).push(d)
  })
  st.forEach((s) => {
    ;(sMap[s.custo_id] = sMap[s.custo_id] || []).push(s)
  })
  res.json(rows.map((c) => ({ ...c, calc: computarCusto(c, dMap[c.id] || [], sMap[c.id] || []) })))
})

rotas.get('/api/fin/custos/:importacaoId', autenticarContabil(), async (req, res) => {
  const impId = parseInt(req.params.importacaoId) || 0
  const [rows] = await banco.query('SELECT * FROM fin_custos WHERE importacao_id = ? ORDER BY id', [impId])
  const lista = []
  for (const c of rows) lista.push(await custoCompleto(c))
  res.json(lista)
})

rotas.post('/api/fin/custos/:importacaoId', autenticarContabil(), async (req, res) => {
  const impId = parseInt(req.params.importacaoId) || 0
  if (!impId) return res.status(400).json({ erro: 'Selecione uma importação.' })
  const b = req.body || {}
  const [r] = await banco.query(
    'INSERT INTO fin_custos (importacao_id, nfe, produto, mp_total, percentual, materia_prima, imposto_importacao, ipi, pis, cofins, icms, quantidade_kg, unidade, obs) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [impId, ...valoresCusto(b)]
  )
  await salvarFilhosCusto(r.insertId, b)
  res.json({ ok: true, id: r.insertId })
})

rotas.put('/api/fin/custos/:importacaoId/:custoId', autenticarContabil(), async (req, res) => {
  const impId = parseInt(req.params.importacaoId) || 0
  const custoId = parseInt(req.params.custoId) || 0
  const [[existe]] = await banco.query('SELECT id FROM fin_custos WHERE id = ? AND importacao_id = ?', [custoId, impId])
  if (!existe) return res.status(404).json({ erro: 'Custo não encontrado.' })
  const b = req.body || {}
  await banco.query(
    'UPDATE fin_custos SET nfe = ?, produto = ?, mp_total = ?, percentual = ?, materia_prima = ?, imposto_importacao = ?, ipi = ?, pis = ?, cofins = ?, icms = ?, quantidade_kg = ?, unidade = ?, obs = ? WHERE id = ?',
    [...valoresCusto(b), custoId]
  )
  await salvarFilhosCusto(custoId, b)
  res.json({ ok: true, id: custoId })
})

rotas.delete('/api/fin/custos/:importacaoId/:custoId', autenticarContabil(), async (req, res) => {
  const impId = parseInt(req.params.importacaoId) || 0
  const custoId = parseInt(req.params.custoId) || 0
  const [[c]] = await banco.query('SELECT id FROM fin_custos WHERE id = ? AND importacao_id = ?', [custoId, impId])
  if (c) {
    await emTransacao(async (conexao) => {
      await conexao.query('DELETE FROM fin_custo_despesas WHERE custo_id = ?', [c.id])
      await conexao.query('DELETE FROM fin_custo_st WHERE custo_id = ?', [c.id])
      await conexao.query('DELETE FROM fin_custos WHERE id = ?', [c.id])
    })
  }
  res.json({ ok: true })
})

module.exports = rotas
