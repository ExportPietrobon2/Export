const express = require('express')
const bcrypt = require('bcryptjs')
const { autenticar } = require('../middlewares/autenticacao')
const { banco } = require('../config/banco')

const rotas = express.Router()

rotas.get('/api/usuarios', autenticar(['admin']), async (req, res) => {
  const [rows] = await banco.query('SELECT id, nome, email, papel FROM usuarios ORDER BY nome')
  res.json(rows)
})

rotas.post('/api/usuarios', autenticar(['admin']), async (req, res) => {
  const { nome, email, senha, papel } = req.body
  const hash = await bcrypt.hash(senha, 10)
  const [resultado] = await banco.query('INSERT INTO usuarios (nome, email, senha, papel) VALUES (?, ?, ?, ?)', [
    nome,
    email,
    hash,
    papel
  ])
  res.json({ id: resultado.insertId })
})

rotas.delete('/api/usuarios/:id', autenticar(['admin']), async (req, res) => {
  await banco.query('DELETE FROM usuarios WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

module.exports = rotas
