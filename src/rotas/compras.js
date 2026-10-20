const express = require('express')
const { TODOS_PERFIS, autenticar } = require('../middlewares/autenticacao')
const { banco } = require('../config/banco')
const { enviarEmail, enviarPush } = require('../servicos/notificacoes')

const rotas = express.Router()

const ROTULOS_TIPO_COMPRA = {
  embalagem: 'Embalagem',
  rotulo: 'Rótulo',
  caixa: 'Caixa',
  etiqueta: 'Etiqueta',
  outro: 'Outro'
}

rotas.get('/api/compras', autenticar(TODOS_PERFIS), async (req, res) => {
  const [rows] = await banco.query(`
 SELECT c.*, p.numero_pi, p.cliente, p.data_embarque
 FROM compras c
 LEFT JOIN pedidos p ON p.id = c.pi_id
 ORDER BY c.criado_em DESC LIMIT 300`)
  res.json(rows)
})

rotas.post('/api/compras', autenticar(['admin', 'compras', 'compras_aromas']), async (req, res) => {
  const {
    descricao,
    tipo,
    quantidade,
    unidade,
    fornecedor,
    data_compra,
    data_prevista,
    custo,
    pi_id,
    observacoes,
    status
  } = req.body
  if (!descricao) return res.status(400).json({ erro: 'Informe o que está sendo comprado.' })

  const [r] = await banco.query(
    `INSERT INTO compras (descricao, tipo, quantidade, unidade, fornecedor, data_compra, data_prevista, custo, pi_id, observacoes, status)
 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      descricao,
      tipo || 'outro',
      parseFloat(quantidade) || 0,
      unidade || null,
      fornecedor || null,
      data_compra || null,
      data_prevista || null,
      custo !== undefined && custo !== null && custo !== '' ? parseFloat(custo) : null,
      pi_id || null,
      observacoes || null,
      status || 'comprado'
    ]
  )

  res.json({ id: r.insertId })
})

rotas.patch('/api/compras/:id', autenticar(['admin', 'compras', 'compras_aromas']), async (req, res) => {
  const campos = [
    'descricao',
    'tipo',
    'quantidade',
    'unidade',
    'fornecedor',
    'data_compra',
    'data_prevista',
    'custo',
    'pi_id',
    'observacoes',
    'status'
  ]
  const sets = []
  const vals = []
  for (const campo of campos) {
    if (campo in req.body) {
      let v = req.body[campo]
      if ((campo === 'quantidade' || campo === 'custo') && v !== '' && v !== null) v = parseFloat(v)
      if (v === '') v = null
      sets.push(`${campo} = ?`)
      vals.push(v)
    }
  }
  if (!sets.length) return res.json({ ok: true })
  vals.push(req.params.id)
  await banco.query(`UPDATE compras SET ${sets.join(', ')} WHERE id = ?`, vals)
  res.json({ ok: true })
})

rotas.patch('/api/compras/:id/receber', autenticar(['admin', 'compras', 'compras_aromas']), async (req, res) => {
  await banco.query(`UPDATE compras SET status = 'recebido', recebido_em = NOW() WHERE id = ?`, [req.params.id])
  const [[c]] = await banco.query(
    `SELECT c.*, p.numero_pi FROM compras c LEFT JOIN pedidos p ON p.id = c.pi_id WHERE c.id = ?`,
    [req.params.id]
  )
  if (c) {
    enviarPush(
      `📦 Compra recebida — lançar no B2`,
      `${c.descricao}${c.numero_pi ? ' · PI ' + c.numero_pi : ''}`,
      '/HTML/estoque/recebimento.html',
      `compra_recebida_${c.id}`
    ).catch(() => {})
    enviarEmail(
      `Compra recebida — lançar no estoque B2 (${c.descricao})`,
      `<h2 style="color:#2E7D32;margin:0 0 16px">Compra Recebida</h2><p style="margin:0 0 12px;color:#8a6a6a">O setor de compras marcou este item como recebido. Depósito/almoxarifado: confiram e lancem no estoque B2.</p><table style="width:100%;border-collapse:collapse;"><tr><td style="padding:8px 0;color:#8a6a6a;width:160px">Item</td><td style="padding:8px 0;font-weight:600">${c.descricao}</td></tr><tr><td style="padding:8px 0;color:#8a6a6a">Tipo</td><td style="padding:8px 0;font-weight:600">${ROTULOS_TIPO_COMPRA[c.tipo] || 'Outro'}</td></tr>
 ${c.quantidade > 0 ? `<tr><td style="padding:8px 0;color:#8a6a6a">Quantidade</td><td style="padding:8px 0;font-weight:600">${c.quantidade} ${c.unidade || ''}</td></tr>` : ''}
 ${c.fornecedor ? `<tr><td style="padding:8px 0;color:#8a6a6a">Fornecedor</td><td style="padding:8px 0;font-weight:600">${c.fornecedor}</td></tr>` : ''}
 ${c.numero_pi ? `<tr><td style="padding:8px 0;color:#8a6a6a">PI vinculada</td><td style="padding:8px 0;font-weight:600">${c.numero_pi}</td></tr>` : ''}
 </table>`,
      ['admin', 'deposito', 'almoxarifado']
    )
  }
  res.json({ ok: true })
})

rotas.delete('/api/compras/:id', autenticar(['admin', 'compras', 'compras_aromas']), async (req, res) => {
  await banco.query('DELETE FROM compras WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

rotas.patch('/api/compras/:id/observacao', autenticar(['admin', 'compras', 'compras_aromas']), async (req, res) => {
  const { observacoes } = req.body
  await banco.query('UPDATE compras SET observacoes = ? WHERE id = ?', [observacoes || null, req.params.id])
  const [[c]] = await banco.query('SELECT descricao FROM compras WHERE id = ?', [req.params.id])
  if (c && observacoes && observacoes.trim()) {
    enviarPush(
      `💬 Observação na compra`,
      `${c.descricao}: ${observacoes.slice(0, 80)}`,
      '/HTML/estoque/compras.html',
      `obs_compra_${Date.now()}`
    ).catch(() => {})
    enviarEmail(
      `Observação na compra — ${c.descricao}`,
      `<h2 style="color:#E65100;margin:0 0 16px">Observação / Verificação de Compra</h2><table style="width:100%;border-collapse:collapse;"><tr><td style="padding:8px 0;color:#8a6a6a;width:140px">Item</td><td style="padding:8px 0;font-weight:600">${c.descricao}</td></tr><tr><td style="padding:8px 0;color:#8a6a6a">Observação</td><td style="padding:8px 0;font-weight:600">${observacoes}</td></tr></table>`,
      ['compras', 'admin']
    )
  }
  res.json({ ok: true })
})

rotas.get('/api/compras/sugestoes', autenticar(TODOS_PERFIS), async (req, res) => {
  const [rows] = await banco.query(`
 SELECT p.id as pi_id, p.numero_pi, p.cliente, p.data_embarque,
 pp.id as produto_id, pp.produto, pp.quantidade,
 ip.tipo as insumo_tipo, ip.sobra
 FROM pedidos p
 JOIN produtos_pi pp ON pp.pi_id = p.id
 JOIN insumos_produto ip ON ip.produto_id = pp.id
 WHERE p.concluida = 0
 AND ( ip.confirmado = 0 OR (ip.tipo = 'etiqueta' AND ip.sobra < 100) )
 ORDER BY (p.data_embarque IS NULL), p.data_embarque ASC, p.numero_pi ASC`)
  res.json(rows)
})

module.exports = rotas
