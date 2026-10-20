const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { banco } = require('../config/banco')
const { CHAVE_JWT } = require('../middlewares/autenticacao')

const rotas = express.Router()

rotas.post('/api/login', async (req, res) => {
  const { email, senha } = req.body
  const [rows] = await banco.query('SELECT * FROM usuarios WHERE email = ?', [email])
  if (rows.length === 0) return res.status(401).json({ erro: 'E-mail ou senha incorretos.' })
  const usuario = rows[0]
  const senhaCorreta = await bcrypt.compare(senha, usuario.senha)
  if (!senhaCorreta) return res.status(401).json({ erro: 'E-mail ou senha incorretos.' })
  const expiracao = '30d'
  const token = jwt.sign(
    { id: usuario.id, nome: usuario.nome, papel: usuario.papel, email: usuario.email },
    CHAVE_JWT,
    { expiresIn: expiracao }
  )
  res.json({ token, papel: usuario.papel, nome: usuario.nome })
})

module.exports = rotas
