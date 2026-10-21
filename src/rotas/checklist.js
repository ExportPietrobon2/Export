const express = require('express')
const { banco, emTransacao } = require('../config/banco')
const { autenticarChecklist } = require('../middlewares/autenticacao')

const rotas = express.Router()

async function inicializarChecklist() {
  try {
    await banco.query(`CREATE TABLE IF NOT EXISTS checklist_exp (
      id INT AUTO_INCREMENT PRIMARY KEY, fatura VARCHAR(60), pedido VARCHAR(60), data_emb DATE,
      cliente_nome VARCHAR(200), cliente_endereco VARCHAR(400), cliente_contato VARCHAR(200),
      embarque VARCHAR(200), descarga VARCHAR(200), destino VARCHAR(200),
      peso_liquido VARCHAR(40), peso_bruto VARCHAR(40), volume VARCHAR(40),
      observacoes VARCHAR(800), criado_por VARCHAR(160), criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
    await banco.query(`CREATE TABLE IF NOT EXISTS checklist_exp_itens (
      id INT AUTO_INCREMENT PRIMARY KEY, checklist_id INT NOT NULL, ordem INT DEFAULT 0,
      produto VARCHAR(300), gramatura VARCHAR(80), qtd_cx VARCHAR(40), lote VARCHAR(80), validade VARCHAR(40),
      INDEX(checklist_id))`)
  } catch (e) {
    console.error('Erro init checklist:', e.message)
  }
}

setTimeout(inicializarChecklist, 3000)

const CAMPOS_CHECKLIST = [
  'fatura',
  'pedido',
  'data_emb',
  'cliente_nome',
  'cliente_endereco',
  'cliente_contato',
  'embarque',
  'descarga',
  'destino',
  'peso_liquido',
  'peso_bruto',
  'volume',
  'observacoes'
]

async function salvarItens(conexao, checklistId, itens) {
  await conexao.query('DELETE FROM checklist_exp_itens WHERE checklist_id = ?', [checklistId])
  if (Array.isArray(itens)) {
    for (let i = 0; i < itens.length; i++) {
      const it = itens[i]
      if (!it || (!it.produto && !it.gramatura && !it.qtd_cx)) continue
      await conexao.query(
        'INSERT INTO checklist_exp_itens (checklist_id, ordem, produto, gramatura, qtd_cx, lote, validade) VALUES (?,?,?,?,?,?,?)',
        [
          checklistId,
          i + 1,
          it.produto || null,
          it.gramatura || null,
          it.qtd_cx || null,
          it.lote || null,
          it.validade || null
        ]
      )
    }
  }
}

rotas.get('/api/checklist', autenticarChecklist(), async (req, res) => {
  const [rows] = await banco.query(
    'SELECT id, fatura, pedido, cliente_nome, data_emb, destino, criado_em FROM checklist_exp ORDER BY id DESC LIMIT 300'
  )
  res.json(rows)
})

rotas.get('/api/checklist/:id', autenticarChecklist(), async (req, res) => {
  const [[cab]] = await banco.query('SELECT * FROM checklist_exp WHERE id = ?', [req.params.id])
  if (!cab) return res.status(404).json({ erro: 'Não encontrado.' })
  const [itens] = await banco.query('SELECT * FROM checklist_exp_itens WHERE checklist_id = ? ORDER BY ordem, id', [
    req.params.id
  ])
  res.json({ ...cab, itens })
})

rotas.post('/api/checklist', autenticarChecklist(), async (req, res) => {
  const b = req.body
  const vals = CAMPOS_CHECKLIST.map((c) => (b[c] === '' || b[c] === undefined ? null : b[c]))
  vals.push(req.usuario.nome || null)
  const id = await emTransacao(async (conexao) => {
    const [r] = await conexao.query(
      `INSERT INTO checklist_exp (${CAMPOS_CHECKLIST.join(', ')}, criado_por) VALUES (${CAMPOS_CHECKLIST.map(() => '?').join(', ')}, ?)`,
      vals
    )
    await salvarItens(conexao, r.insertId, b.itens)
    return r.insertId
  })
  res.json({ id })
})

rotas.put('/api/checklist/:id', autenticarChecklist(), async (req, res) => {
  const b = req.body
  const sets = CAMPOS_CHECKLIST.map((c) => `${c} = ?`)
  const vals = CAMPOS_CHECKLIST.map((c) => (b[c] === '' || b[c] === undefined ? null : b[c]))
  vals.push(req.params.id)
  await emTransacao(async (conexao) => {
    await conexao.query(`UPDATE checklist_exp SET ${sets.join(', ')} WHERE id = ?`, vals)
    await salvarItens(conexao, req.params.id, b.itens)
  })
  res.json({ ok: true })
})

rotas.delete('/api/checklist/:id', autenticarChecklist(), async (req, res) => {
  await emTransacao(async (conexao) => {
    await conexao.query('DELETE FROM checklist_exp_itens WHERE checklist_id = ?', [req.params.id])
    await conexao.query('DELETE FROM checklist_exp WHERE id = ?', [req.params.id])
  })
  res.json({ ok: true })
})

module.exports = rotas
