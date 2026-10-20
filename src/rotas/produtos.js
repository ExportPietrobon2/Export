const express = require('express')
const { TODOS_PERFIS, autenticar } = require('../middlewares/autenticacao')
const { banco } = require('../config/banco')
const { enviarEmail, enviarPush } = require('../servicos/notificacoes')

const rotas = express.Router()

rotas.get('/api/pedidos/:piId/produtos', autenticar(TODOS_PERFIS), async (req, res) => {
  const [produtos] = await banco.query('SELECT * FROM produtos_pi WHERE pi_id = ?', [req.params.piId])
  res.json(produtos)
})

rotas.post('/api/produtos', autenticar(['admin']), async (req, res) => {
  const { pi_id, produto, quantidade, observacoes } = req.body
  const [resultado] = await banco.query(
    'INSERT INTO produtos_pi (pi_id, produto, quantidade, observacoes) VALUES (?, ?, ?, ?)',
    [pi_id, produto, quantidade, observacoes || null]
  )
  const produtoId = resultado.insertId
  const tiposInsumo = ['embalagem', 'rotulo', 'caixa', 'etiqueta']
  for (const tipo of tiposInsumo) {
    await banco.query(
      'INSERT INTO insumos_produto (produto_id, tipo, confirmado, sobra, quantidade_por_pacote) VALUES (?, ?, 0, 0, 0)',
      [produtoId, tipo]
    )
  }
  const tiposRecebimento = ['embalagem', 'rotulo', 'caixa']
  const piId = req.body.pi_id
  for (const tipo of tiposRecebimento) {
    await banco.query('INSERT INTO recebimentos_b2 (pi_id, produto_id, tipo, status_recebimento) VALUES (?, ?, ?, ?)', [
      piId,
      produtoId,
      tipo,
      'pendente'
    ])
  }
  res.json({ id: produtoId })
})

rotas.get('/api/produtos/:produtoId/insumos', autenticar(TODOS_PERFIS), async (req, res) => {
  const [produto] = await banco.query('SELECT * FROM produtos_pi WHERE id = ?', [req.params.produtoId])
  const [insumos] = await banco.query('SELECT * FROM insumos_produto WHERE produto_id = ?', [req.params.produtoId])
  res.json({ produto: produto[0], insumos })
})

rotas.patch('/api/produtos/:produtoId/insumos', autenticar(['admin', 'almoxarifado']), async (req, res) => {
  try {
    const { insumos, rotulos, observacoes, quantidade } = req.body

    const [antesInsumos] = await banco.query('SELECT tipo, confirmado FROM insumos_produto WHERE produto_id = ?', [
      req.params.produtoId
    ])
    const antesSemEtiqueta = antesInsumos.filter((i) => i.tipo !== 'etiqueta')
    const eraLiberado = antesSemEtiqueta.length > 0 && antesSemEtiqueta.every((i) => i.confirmado)

    for (const insumo of insumos || []) {
      if (insumo.tipo === 'rotulo') continue
      let confirmado = 0
      if (insumo.tipo === 'etiqueta') {
        confirmado = 1
      } else if (insumo.tipo === 'caixa') {
        confirmado = Number(insumo.sobra) >= Number(quantidade) ? 1 : 0
      } else {
        confirmado = Number(insumo.sobra) > 0 ? 1 : 0
      }
      await banco.query(
        'UPDATE insumos_produto SET sobra = ?, quantidade_por_pacote = ?, confirmado = ? WHERE produto_id = ? AND tipo = ?',
        [
          parseFloat(insumo.sobra) || 0,
          parseFloat(insumo.quantidade_por_pacote) || 0,
          confirmado,
          req.params.produtoId,
          insumo.tipo
        ]
      )
    }

    if (Array.isArray(rotulos)) {
      await banco.query('DELETE FROM insumos_produto WHERE produto_id = ? AND tipo = ?', [
        req.params.produtoId,
        'rotulo'
      ])
      for (const r of rotulos) {
        const confirmado = Number(r.sobra) > 0 ? 1 : 0
        await banco.query(
          'INSERT INTO insumos_produto (produto_id, tipo, nome, confirmado, sobra, quantidade_por_pacote) VALUES (?, ?, ?, ?, ?, ?)',
          [req.params.produtoId, 'rotulo', r.nome || null, confirmado, r.sobra || 0, r.quantidade_por_pacote || 0]
        )
      }
    }

    if (observacoes !== undefined) {
      await banco.query('UPDATE produtos_pi SET observacoes = ? WHERE id = ?', [observacoes, req.params.produtoId])
    }

    await banco.query('UPDATE produtos_pi SET declarado_em = NOW() WHERE id = ? AND declarado_em IS NULL', [
      req.params.produtoId
    ])

    const [produtoInfo] = await banco.query(
      'SELECT pp.pi_id, pp.produto, p.numero_pi, p.cliente FROM produtos_pi pp JOIN pedidos p ON p.id = pp.pi_id WHERE pp.id = ?',
      [req.params.produtoId]
    )
    const [todosInsumos] = await banco.query(
      'SELECT tipo, confirmado, sobra FROM insumos_produto WHERE produto_id = ?',
      [req.params.produtoId]
    )

    if (produtoInfo[0]) {
      const { pi_id, numero_pi, cliente } = produtoInfo[0]

      const semEtiqueta = todosInsumos.filter((i) => i.tipo !== 'etiqueta')
      const produtoLiberado = semEtiqueta.length > 0 && semEtiqueta.every((i) => i.confirmado)

      const [outros] = await banco.query(
        `SELECT SUM(CASE WHEN ip.tipo <> 'etiqueta' AND ip.confirmado = 0 THEN 1 ELSE 0 END) as pendentes
 FROM produtos_pi pp JOIN insumos_produto ip ON ip.produto_id = pp.id
 WHERE pp.pi_id = ? AND pp.id <> ?
 GROUP BY pp.id`,
        [pi_id, req.params.produtoId]
      )
      const outrosLiberados = outros.every((o) => Number(o.pendentes) === 0)
      const piEraLiberada = outrosLiberados && eraLiberado
      const piEstaLiberada = outrosLiberados && produtoLiberado

      if (piEstaLiberada && !piEraLiberada) {
        enviarPush(
          `✅ PI Liberada — ${numero_pi}`,
          `${cliente || ''} — todos os insumos confirmados.`,
          '/HTML/producao/admin.html',
          `pi_liberada_${numero_pi}`
        ).catch(() => {})
        enviarEmail(
          `PI Liberada para Produção — ${numero_pi}`,
          `<h2 style="color:#2E7D32;margin:0 0 16px">PI Liberada para Produção</h2><table style="width:100%;border-collapse:collapse;"><tr><td style="padding:8px 0;color:#8a6a6a;width:140px">PI</td><td style="padding:8px 0;font-weight:600">${numero_pi}</td></tr><tr><td style="padding:8px 0;color:#8a6a6a">Cliente</td><td style="padding:8px 0;font-weight:600">${cliente || '—'}</td></tr></table><p style="margin:16px 0 0;color:#2E7D32;font-weight:600">Todos os produtos desta PI estão com os insumos disponíveis para produção.</p>`,
          ['admin', 'gerente_producao', 'almoxarifado']
        )
      }
    }

    res.json({ ok: true })
  } catch (e) {
    console.error('Erro ao salvar insumos:', e.message)
    if (!res.headersSent) res.status(500).json({ erro: 'Erro ao salvar. Tente novamente.' })
  }
})

module.exports = rotas
