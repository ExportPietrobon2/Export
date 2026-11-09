const express = require('express')
const bcrypt = require('bcryptjs')
const { autenticar, emailPermitido } = require('../middlewares/autenticacao')
const { banco } = require('../config/banco')

const rotas = express.Router()

rotas.get('/api/usuarios', autenticar(), async (req, res) => {
  const [rows] = await banco.query('SELECT id, nome, email, papel FROM usuarios ORDER BY nome')
  res.json(rows)
})

rotas.post('/api/usuarios', autenticar(), async (req, res) => {
  const { nome, email, senha } = req.body || {}
  if (!emailPermitido(email)) return res.status(400).json({ erro: 'Este e-mail não tem acesso ao sistema.' })
  if (!senha || String(senha).length < 6)
    return res.status(400).json({ erro: 'A senha precisa ter ao menos 6 caracteres.' })
  const hash = await bcrypt.hash(senha, 10)
  const [resultado] = await banco.query(
    'INSERT INTO usuarios (nome, email, senha, papel) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE nome = VALUES(nome), senha = VALUES(senha), papel = VALUES(papel)',
    [nome || email, String(email).trim().toLowerCase(), hash, 'admin']
  )
  res.json({ id: resultado.insertId })
})

rotas.delete('/api/usuarios/:id', autenticar(), async (req, res) => {
  await banco.query('DELETE FROM usuarios WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

module.exports = rotas
