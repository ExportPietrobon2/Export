const express = require('express')
const { autenticarContabil } = require('../middlewares/autenticacao')
const { banco } = require('../config/banco')

const rotas = express.Router()

const CAMPOS_NFE = [
  'ano',
  'mes',
  'data',
  'nf',
  'fatura',
  'num_due',
  'data_due',
  'num_conhecimento',
  'data_conhecimento',
  'tipo',
  'valor_nfe',
  'peso',
  'vendedor',
  'produto',
  'pais'
]

rotas.get('/api/contabil/anos', autenticarContabil(), async (req, res) => {
  const [rows] = await banco.query('SELECT DISTINCT ano FROM nfe_lancamentos ORDER BY ano DESC')
  const anos = rows.map((r) => r.ano)
  const atual = new Date().getFullYear()
  if (!anos.includes(atual)) anos.unshift(atual)
  res.json(anos)
})

rotas.get('/api/contabil', autenticarContabil(), async (req, res) => {
  const ano = parseInt(req.query.ano) || new Date().getFullYear()
  const [rows] = await banco.query('SELECT * FROM nfe_lancamentos WHERE ano = ? ORDER BY mes ASC, data ASC, id ASC', [
    ano
  ])
  res.json(rows)
})

rotas.post('/api/contabil', autenticarContabil(), async (req, res) => {
  const b = req.body
  if (!b.ano || !b.mes) return res.status(400).json({ erro: 'Ano e mês são obrigatórios.' })
  const vals = CAMPOS_NFE.map((c) => {
    let v = b[c]
    if (v === '' || v === undefined) v = null
    if ((c === 'valor_nfe' || c === 'peso') && v !== null) v = parseFloat(String(v).replace(',', '.')) || 0
    if ((c === 'ano' || c === 'mes') && v !== null) v = parseInt(v)
    return v
  })
  const [r] = await banco.query(
    `INSERT INTO nfe_lancamentos (${CAMPOS_NFE.join(', ')}) VALUES (${CAMPOS_NFE.map(() => '?').join(', ')})`,
    vals
  )
  res.json({ id: r.insertId })
})

rotas.patch('/api/contabil/:id', autenticarContabil(), async (req, res) => {
  const sets = [],
    vals = []
  for (const c of CAMPOS_NFE) {
    if (c in req.body) {
      let v = req.body[c]
      if (v === '' || v === undefined) v = null
      if ((c === 'valor_nfe' || c === 'peso') && v !== null) v = parseFloat(String(v).replace(',', '.')) || 0
      if ((c === 'ano' || c === 'mes') && v !== null) v = parseInt(v)
      sets.push(`${c} = ?`)
      vals.push(v)
    }
  }
  if (!sets.length) return res.json({ ok: true })
  vals.push(req.params.id)
  await banco.query(`UPDATE nfe_lancamentos SET ${sets.join(', ')} WHERE id = ?`, vals)
  res.json({ ok: true })
})

rotas.delete('/api/contabil/:id', autenticarContabil(), async (req, res) => {
  await banco.query('DELETE FROM nfe_lancamentos WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

module.exports = rotas
