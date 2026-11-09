const express = require('express')
const { CHAVE_PUBLICA_VAPID, garantirTabelaPush } = require('../servicos/notificacoes')
const { autenticar } = require('../middlewares/autenticacao')
const { banco } = require('../config/banco')

const rotas = express.Router()

rotas.get('/api/push/vapid-public', (req, res) => res.json({ key: CHAVE_PUBLICA_VAPID }))

rotas.post('/api/push/subscribe', autenticar(), async (req, res) => {
  const { endpoint, keys } = req.body
  if (!endpoint || !keys?.p256dh || !keys?.auth) return res.status(400).json({ erro: 'Dados inválidos' })
  try {
    await garantirTabelaPush()
    await banco.query(
      'INSERT INTO push_subscriptions (usuario_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE p256dh = VALUES(p256dh), auth = VALUES(auth), usuario_id = VALUES(usuario_id)',
      [req.usuario?.id || null, endpoint, keys.p256dh, keys.auth]
    )
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ erro: e.message })
  }
})

module.exports = rotas
