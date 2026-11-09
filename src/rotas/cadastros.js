const express = require('express')
const { autenticar } = require('../middlewares/autenticacao')
const { banco } = require('../config/banco')

const rotas = express.Router()

const vazioParaNulo = (v) => {
  const s = v == null ? '' : String(v).trim()
  return s === '' ? null : s
}

rotas.get('/api/cadastros/clientes', autenticar(), async (req, res) => {
  const [rows] = await banco.query(`
    SELECT c.*,
      (SELECT COUNT(*) FROM nfe_lancamentos n WHERE n.cliente_id = c.id) AS qtd_notas
    FROM ec_clientes c ORDER BY c.ativo DESC, c.nome`)
  res.json(rows)
})

rotas.post('/api/cadastros/clientes', autenticar(), async (req, res) => {
  const nome = vazioParaNulo(req.body.nome)
  if (!nome) return res.status(400).json({ erro: 'Informe o nome do cliente.' })
  const [[ex]] = await banco.query('SELECT id FROM ec_clientes WHERE LOWER(TRIM(nome)) = LOWER(?)', [nome])
  if (ex) return res.status(400).json({ erro: 'Já existe um cliente com este nome.' })
  const [r] = await banco.query('INSERT INTO ec_clientes (nome, pais, ativo) VALUES (?, ?, 1)', [
    nome,
    vazioParaNulo(req.body.pais)
  ])
  res.json({ ok: true, id: r.insertId })
})

rotas.patch('/api/cadastros/clientes/:id', autenticar(), async (req, res) => {
  const sets = []
  const vals = []
  if ('nome' in req.body) {
    const nome = vazioParaNulo(req.body.nome)
    if (!nome) return res.status(400).json({ erro: 'Informe o nome do cliente.' })
    sets.push('nome = ?')
    vals.push(nome)
  }
  if ('pais' in req.body) {
    sets.push('pais = ?')
    vals.push(vazioParaNulo(req.body.pais))
  }
  if ('ativo' in req.body) {
    sets.push('ativo = ?')
    vals.push(req.body.ativo ? 1 : 0)
  }
  if (!sets.length) return res.json({ ok: true })
  vals.push(req.params.id)
  await banco.query(`UPDATE ec_clientes SET ${sets.join(', ')} WHERE id = ?`, vals)
  res.json({ ok: true })
})

rotas.get('/api/cadastros/fornecedores', autenticar(), async (req, res) => {
  const [rows] = await banco.query(`
    SELECT f.*,
      (SELECT COUNT(*) FROM fin_importacoes i WHERE i.fornecedor_id = f.id) AS qtd_importacoes
    FROM fin_fornecedores f ORDER BY f.ativo DESC, f.nome`)
  res.json(rows)
})

const CAMPOS_FORNECEDOR = ['nome', 'pais', 'moeda', 'contato', 'email', 'obs']

rotas.post('/api/cadastros/fornecedores', autenticar(), async (req, res) => {
  const b = req.body || {}
  const nome = vazioParaNulo(b.nome)
  if (!nome) return res.status(400).json({ erro: 'Informe o nome do fornecedor.' })
  const [[ex]] = await banco.query('SELECT id FROM fin_fornecedores WHERE LOWER(TRIM(nome)) = LOWER(?)', [nome])
  if (ex) return res.status(400).json({ erro: 'Já existe um fornecedor com este nome.' })
  const [r] = await banco.query(
    'INSERT INTO fin_fornecedores (nome, pais, moeda, contato, email, obs, ativo) VALUES (?,?,?,?,?,?,1)',
    [
      nome,
      vazioParaNulo(b.pais),
      vazioParaNulo(b.moeda) || 'USD',
      vazioParaNulo(b.contato),
      vazioParaNulo(b.email),
      vazioParaNulo(b.obs)
    ]
  )
  res.json({ ok: true, id: r.insertId })
})

rotas.patch('/api/cadastros/fornecedores/:id', autenticar(), async (req, res) => {
  const sets = []
  const vals = []
  for (const c of CAMPOS_FORNECEDOR) {
    if (c in req.body) {
      const v = vazioParaNulo(req.body[c])
      if (c === 'nome' && !v) return res.status(400).json({ erro: 'Informe o nome do fornecedor.' })
      sets.push(`${c} = ?`)
      vals.push(v)
    }
  }
  if ('ativo' in req.body) {
    sets.push('ativo = ?')
    vals.push(req.body.ativo ? 1 : 0)
  }
  if (!sets.length) return res.json({ ok: true })
  vals.push(req.params.id)
  await banco.query(`UPDATE fin_fornecedores SET ${sets.join(', ')} WHERE id = ?`, vals)
  res.json({ ok: true })
})

rotas.delete('/api/cadastros/fornecedores/:id', autenticar(), async (req, res) => {
  const [[uso]] = await banco.query(
    `SELECT (SELECT COUNT(*) FROM fin_importacoes WHERE fornecedor_id = ?) +
            (SELECT COUNT(*) FROM ec_lanc_adiant_fornecedores WHERE fornecedor_id = ?) AS n`,
    [req.params.id, req.params.id]
  )
  if (Number(uso.n) > 0)
    return res.status(400).json({ erro: 'Fornecedor com lançamentos. Desative em vez de excluir.' })
  await banco.query('DELETE FROM fin_fornecedores WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

module.exports = rotas
