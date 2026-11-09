const express = require('express')
const { autenticar } = require('../middlewares/autenticacao')
const { banco } = require('../config/banco')
const { dataISO } = require('../servicos/financeiro')

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
  'pais',
  'cliente_id',
  'entra_fechamento'
]

function normalizar(c, v) {
  if (v === '' || v === undefined) v = null
  if (v === null) return c === 'entra_fechamento' ? 0 : null
  if (c === 'valor_nfe' || c === 'peso') return parseFloat(String(v).replace(',', '.')) || 0
  if (c === 'ano' || c === 'mes' || c === 'cliente_id') return parseInt(v) || null
  if (c === 'entra_fechamento') return v ? 1 : 0
  return v
}

async function prepararRegistro(b, atual) {
  const r = { ...(atual || {}) }
  for (const c of ['data', 'data_due', 'data_conhecimento']) if (r[c]) r[c] = dataISO(r[c])
  for (const c of CAMPOS_NFE) if (c in b) r[c] = normalizar(c, b[c])
  if (r.data) {
    const [ano, mes] = String(r.data).slice(0, 10).split('-').map(Number)
    r.ano = ano
    r.mes = mes
  }
  if (!r.cliente_id) r.entra_fechamento = 0
  else if (!atual && !('entra_fechamento' in b)) r.entra_fechamento = 1
  let aviso = null
  if (r.cliente_id) {
    const [[cli]] = await banco.query('SELECT pais FROM ec_clientes WHERE id = ?', [r.cliente_id])
    if (cli && !r.pais) r.pais = cli.pais
    if (r.entra_fechamento && r.fatura) {
      const [[manual]] = await banco.query(
        "SELECT id FROM ec_lanc_exterior WHERE cliente_id = ? AND tipo = 'debito' AND fatura = ?",
        [r.cliente_id, r.fatura]
      )
      if (manual) {
        r.entra_fechamento = 0
        aviso =
          'Já existe um débito lançado à mão no Fechamento para esta fatura. A nota foi salva, mas não gerou outro débito para não duplicar.'
      }
    }
  }
  return { registro: r, aviso }
}

rotas.get('/api/contabil/anos', autenticar(), async (req, res) => {
  const [rows] = await banco.query('SELECT DISTINCT ano FROM nfe_lancamentos ORDER BY ano DESC')
  const anos = rows.map((r) => r.ano)
  const atual = new Date().getFullYear()
  if (!anos.includes(atual)) anos.unshift(atual)
  res.json(anos)
})

rotas.get('/api/contabil', autenticar(), async (req, res) => {
  const ano = parseInt(req.query.ano) || new Date().getFullYear()
  const [rows] = await banco.query(
    `SELECT n.*, c.nome AS cliente_nome FROM nfe_lancamentos n LEFT JOIN ec_clientes c ON c.id = n.cliente_id
     WHERE n.ano = ? ORDER BY n.mes ASC, n.data ASC, n.id ASC`,
    [ano]
  )
  res.json(rows)
})

rotas.post('/api/contabil', autenticar(), async (req, res) => {
  const { registro, aviso } = await prepararRegistro(req.body || {}, null)
  if (!registro.ano || !registro.mes) return res.status(400).json({ erro: 'Informe a data (ou o mês) da nota.' })
  if (!(registro.valor_nfe > 0)) return res.status(400).json({ erro: 'Informe o valor da nota.' })
  const colunas = CAMPOS_NFE.filter((c) => c in registro)
  const [r] = await banco.query(
    `INSERT INTO nfe_lancamentos (${colunas.join(', ')}) VALUES (${colunas.map(() => '?').join(', ')})`,
    colunas.map((c) => registro[c])
  )
  res.json({ id: r.insertId, aviso })
})

rotas.patch('/api/contabil/:id', autenticar(), async (req, res) => {
  const [[atual]] = await banco.query('SELECT * FROM nfe_lancamentos WHERE id = ?', [req.params.id])
  if (!atual) return res.status(404).json({ erro: 'Nota não encontrada.' })
  const { registro, aviso } = await prepararRegistro(req.body || {}, atual)
  await banco.query(`UPDATE nfe_lancamentos SET ${CAMPOS_NFE.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [
    ...CAMPOS_NFE.map((c) => (registro[c] === undefined ? null : registro[c])),
    req.params.id
  ])
  res.json({ ok: true, aviso })
})

rotas.delete('/api/contabil/:id', autenticar(), async (req, res) => {
  await banco.query('DELETE FROM nfe_lancamentos WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

module.exports = rotas
