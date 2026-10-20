const express = require('express')
const { TODOS_PERFIS, autenticar } = require('../middlewares/autenticacao')
const { banco } = require('../config/banco')
const { enviarEmail, enviarPush } = require('../servicos/notificacoes')

const rotas = express.Router()

rotas.get('/api/demandas', autenticar(TODOS_PERFIS), async (req, res) => {
  const [rows] = await banco.query(`
 SELECT d.*, p.numero_pi, p.cliente
 FROM demandas d
 LEFT JOIN pedidos p ON p.id = d.pi_id
 ORDER BY (d.status <> 'pendente'), d.criado_em DESC LIMIT 300`)
  res.json(rows)
})

rotas.post('/api/demandas', autenticar(['admin', 'almoxarifado']), async (req, res) => {
  const { descricao, quantidade, unidade, pi_id, observacoes } = req.body
  const categoria = req.body.categoria === 'aromas' ? 'aromas' : 'gerais'
  if (!descricao) return res.status(400).json({ erro: 'Informe o que está faltando.' })

  const [r] = await banco.query(
    `INSERT INTO demandas (descricao, quantidade, unidade, pi_id, observacoes, solicitante, categoria)
 VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      descricao,
      parseFloat(quantidade) || 0,
      unidade || null,
      pi_id || null,
      observacoes || null,
      req.usuario && req.usuario.nome ? req.usuario.nome : null,
      categoria
    ]
  )

  const destino = categoria === 'aromas' ? ['admin', 'compras_aromas'] : ['admin', 'compras']
  const label = categoria === 'aromas' ? 'Aromas' : 'Insumos gerais'
  const [[pi]] = pi_id ? await banco.query('SELECT numero_pi FROM pedidos WHERE id = ?', [pi_id]) : [[null]]
  enviarPush(
    `🛒 Novo pedido ao Compras`,
    `${descricao}${pi && pi.numero_pi ? ' · PI ' + pi.numero_pi : ''}`,
    '/HTML/estoque/compras.html',
    `demanda_${Date.now()}`
  ).catch(() => {})
  enviarEmail(
    `Novo pedido ao Compras (${label}) — ${descricao}`,
    `<h2 style="color:#6A1B9A;margin:0 0 16px">Novo Pedido ao Compras — ${label}</h2><table style="width:100%;border-collapse:collapse;"><tr><td style="padding:8px 0;color:#8a6a6a;width:160px">Item</td><td style="padding:8px 0;font-weight:600">${descricao}</td></tr>
 ${parseFloat(quantidade) > 0 ? `<tr><td style="padding:8px 0;color:#8a6a6a">Quantidade</td><td style="padding:8px 0;font-weight:600">${quantidade} ${unidade || ''}</td></tr>` : ''}
 ${pi && pi.numero_pi ? `<tr><td style="padding:8px 0;color:#8a6a6a">PI</td><td style="padding:8px 0;font-weight:600">${pi.numero_pi}</td></tr>` : ''}
 ${req.usuario && req.usuario.nome ? `<tr><td style="padding:8px 0;color:#8a6a6a">Solicitante</td><td style="padding:8px 0;font-weight:600">${req.usuario.nome}</td></tr>` : ''}
 </table><p style="margin:16px 0 0;color:#6A1B9A;font-weight:600">Compras: verificar disponibilidade e marcar "Tenho" ou "Não tenho".</p>`,
    destino
  )
  res.json({ id: r.insertId })
})

rotas.patch('/api/demandas/:id/status', autenticar(['admin', 'compras', 'compras_aromas']), async (req, res) => {
  const { status } = req.body
  if (!['tem', 'nao_tem', 'pendente'].includes(status)) return res.status(400).json({ erro: 'Status inválido.' })
  const quem = req.usuario && req.usuario.nome ? req.usuario.nome : null
  await banco.query('UPDATE demandas SET status = ?, respondido_por = ?, respondido_em = NOW() WHERE id = ?', [
    status,
    quem,
    req.params.id
  ])

  const [[d]] = await banco.query(
    'SELECT d.*, p.numero_pi FROM demandas d LEFT JOIN pedidos p ON p.id = d.pi_id WHERE d.id = ?',
    [req.params.id]
  )
  if (d) {
    const label = status === 'tem' ? 'TEM em estoque' : status === 'nao_tem' ? 'NÃO TEM — precisa comprar' : 'Pendente'
    const cor = status === 'nao_tem' ? '#ED3237' : '#2E7D32'
    enviarPush(
      `Demanda respondida — ${status === 'nao_tem' ? '❌ NÃO TEM' : status === 'tem' ? '✅ TEM' : '⏳ Pendente'}`,
      `${d.descricao}${d.numero_pi ? ' · PI ' + d.numero_pi : ''}`,
      '/HTML/estoque/compras.html',
      `demanda_resp_${req.params.id}`
    ).catch(() => {})
    enviarEmail(
      `Demanda respondida (${status === 'nao_tem' ? 'NÃO TEM' : status === 'tem' ? 'TEM' : 'pendente'}) — ${d.descricao}`,
      `<h2 style="color:${cor};margin:0 0 16px">Demanda de Compra Respondida</h2><table style="width:100%;border-collapse:collapse;"><tr><td style="padding:8px 0;color:#8a6a6a;width:160px">Item</td><td style="padding:8px 0;font-weight:600">${d.descricao}</td></tr>
 ${d.numero_pi ? `<tr><td style="padding:8px 0;color:#8a6a6a">PI</td><td style="padding:8px 0;font-weight:600">${d.numero_pi}</td></tr>` : ''}
 <tr><td style="padding:8px 0;color:#8a6a6a">Resposta</td><td style="padding:8px 0;font-weight:700;color:${cor}">${label}</td></tr>
 ${quem ? `<tr><td style="padding:8px 0;color:#8a6a6a">Respondido por</td><td style="padding:8px 0;font-weight:600">${quem}</td></tr>` : ''}
 </table>`,
      ['admin', 'almoxarifado', 'compras', 'compras_aromas']
    )
  }
  res.json({ ok: true })
})

rotas.delete('/api/demandas/:id', autenticar(['admin', 'almoxarifado']), async (req, res) => {
  await banco.query('DELETE FROM demandas WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

module.exports = rotas
