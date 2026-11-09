const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { banco } = require('../config/banco')
const { CHAVE_JWT, emailPermitido } = require('../middlewares/autenticacao')

const rotas = express.Router()

rotas.post('/api/login', async (req, res) => {
  const email = String((req.body && req.body.email) || '')
    .trim()
    .toLowerCase()
  const senha = String((req.body && req.body.senha) || '')
  const negado = () => res.status(401).json({ erro: 'E-mail ou senha incorretos.' })
  if (!emailPermitido(email)) return negado()
  const [rows] = await banco.query('SELECT * FROM usuarios WHERE LOWER(email) = ?', [email])
  if (!rows.length) return negado()
  const usuario = rows[0]
  if (!(await bcrypt.compare(senha, usuario.senha))) return negado()
  const token = jwt.sign({ id: usuario.id, nome: usuario.nome, papel: 'admin', email }, CHAVE_JWT, {
    expiresIn: '30d'
  })
  res.json({ token, papel: 'admin', nome: usuario.nome })
})

module.exports = rotas
