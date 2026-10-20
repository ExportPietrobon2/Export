const express = require('express')
const { TODOS_PERFIS, autenticar } = require('../middlewares/autenticacao')
const { banco } = require('../config/banco')
const { enviarEmail, enviarPush } = require('../servicos/notificacoes')

const rotas = express.Router()

rotas.get('/api/pedidos', autenticar(TODOS_PERFIS), async (req, res) => {
  const incluirConcluidas = req.query.incluirConcluidas === 'true'
  const condicao = incluirConcluidas ? '' : 'WHERE concluida = 0'
  const [pedidos] = await banco.query(`SELECT * FROM pedidos ${condicao} ORDER BY numero_pi DESC`)
  res.json(pedidos)
})

rotas.get('/api/pedidos/completo', autenticar(TODOS_PERFIS), async (req, res) => {
  const incluirConcluidas = req.query.incluirConcluidas === 'true'
  const condicao = incluirConcluidas ? '' : 'WHERE p.concluida = 0'
  const [pedidos] = await banco.query(`SELECT * FROM pedidos p ${condicao} ORDER BY p.numero_pi DESC`)

  for (const pedido of pedidos) {
    const [produtos] = await banco.query('SELECT * FROM produtos_pi WHERE pi_id = ?', [pedido.id])
    for (const produto of produtos) {
      const [insumos] = await banco.query('SELECT * FROM insumos_produto WHERE produto_id = ?', [produto.id])
      produto.insumos_produto = insumos
    }
    pedido.produtos_pi = produtos
    const [recebimentos] = await banco.query(
      `SELECT r.tipo, r.status_recebimento, r.foto_url, r.foto_nota_url, r.quantidade_recebida,
 r.produto_id, pr.produto as nome_produto
 FROM recebimentos_b2 r
 LEFT JOIN produtos_pi pr ON pr.id = r.produto_id
 WHERE r.pi_id = ?`,
      [pedido.id]
    )
    pedido.recebimentos_b2 = recebimentos

    const [vinculosEstoque] = await banco.query(
      `SELECT v.*, e.produto as produto_entrada, e.embalagem_kg as entrada_emb,
 e.rotulo_kg as entrada_rot, e.pallet_caixas as entrada_pal,
 e.foto_url as entrada_foto, e.foto_nota_url as entrada_foto_nota,
 e.localizacao as entrada_localizacao,
 e.criado_em as entrada_data
 FROM vinculos_insumos v
 JOIN estoque_insumos e ON e.id = v.entrada_id
 WHERE v.pi_id = ?
 ORDER BY v.criado_em DESC`,
      [pedido.id]
    )
    pedido.vinculos_estoque = vinculosEstoque
  }
  res.json(pedidos)
})

rotas.post('/api/pedidos', autenticar(['admin']), async (req, res) => {
  const { numero_pi, data_cadastro, cliente, destino } = req.body
  const [resultado] = await banco.query(
    'INSERT INTO pedidos (numero_pi, data_cadastro, cliente, destino) VALUES (?, ?, ?, ?)',
    [numero_pi, data_cadastro || null, cliente || null, destino || null]
  )
  const piId = resultado.insertId
  res.json({ id: piId })
  const chaveNovaPi = `nova_pi_${new Date().toISOString().slice(0, 10)}`
  const tituloNovaPi = `Nova PI cadastrada — ${numero_pi}`
  const detalheNovaPi = [cliente && `Cliente: ${cliente}`, destino && `Destino: ${destino}`].filter(Boolean).join(' · ')
  enviarPush(
    tituloNovaPi,
    detalheNovaPi || 'Acesse o sistema para ver os detalhes.',
    '/HTML/producao/visao-geral.html',
    chaveNovaPi
  ).catch(() => {})
  enviarEmail(
    tituloNovaPi,
    `<h2 style="color:#ED3237;margin:0 0 16px">Nova PI Cadastrada</h2>
   <table style="width:100%;border-collapse:collapse;">
     <tr><td style="padding:8px 0;color:#8a6a6a;width:140px">Número</td><td style="padding:8px 0;font-weight:700">${numero_pi}</td></tr>
     ${cliente ? `<tr><td style="padding:8px 0;color:#8a6a6a">Cliente</td><td style="padding:8px 0;font-weight:600">${cliente}</td></tr>` : ''}
     ${destino ? `<tr><td style="padding:8px 0;color:#8a6a6a">Destino</td><td style="padding:8px 0;font-weight:600">${destino}</td></tr>` : ''}
   </table>`,
    ['admin', 'almoxarifado']
  ).catch(() => {})
})

rotas.patch('/api/pedidos/:id/embarque', autenticar(['admin', 'gerente_producao']), async (req, res) => {
  const { data_embarque } = req.body
  await banco.query('UPDATE pedidos SET data_embarque = ? WHERE id = ?', [data_embarque || null, req.params.id])

  const [[pi]] = await banco.query('SELECT numero_pi, cliente, destino FROM pedidos WHERE id = ?', [req.params.id])
  if (pi) {
    const dataFmt = data_embarque ? new Date(data_embarque + 'T00:00:00').toLocaleDateString('pt-BR') : '—'
    enviarPush(
      `Data de embarque — PI ${pi.numero_pi}`,
      `${pi.cliente || ''} · ${dataFmt}`,
      '/HTML/estoque/embarques.html',
      `embarque_def_${pi.numero_pi}`
    ).catch(() => {})
    enviarEmail(
      `Data de embarque definida — PI ${pi.numero_pi}`,
      `<h2 style="color:#1565C0;margin:0 0 16px">Data de Embarque Definida</h2><table style="width:100%;border-collapse:collapse;"><tr><td style="padding:8px 0;color:#8a6a6a;width:160px">PI</td><td style="padding:8px 0;font-weight:600">${pi.numero_pi}</td></tr>
 ${pi.cliente ? `<tr><td style="padding:8px 0;color:#8a6a6a">Cliente</td><td style="padding:8px 0;font-weight:600">${pi.cliente}</td></tr>` : ''}
 ${pi.destino ? `<tr><td style="padding:8px 0;color:#8a6a6a">Destino</td><td style="padding:8px 0;font-weight:600">${pi.destino}</td></tr>` : ''}
 <tr><td style="padding:8px 0;color:#8a6a6a">Data de embarque</td><td style="padding:8px 0;font-weight:600;color:#1565C0">${dataFmt}</td></tr></table>`,
      ['admin', 'gerente_producao', 'almoxarifado']
    )
  }
  res.json({ ok: true })
})

rotas.patch('/api/pedidos/:id/comentario-embarque', autenticar(['admin']), async (req, res) => {
  const { comentario } = req.body
  const nomeUsuario = req.usuario?.nome || req.usuario?.email || 'Admin'
  await banco.query('UPDATE pedidos SET comentario_embarque = ?, comentario_usuario = ? WHERE id = ?', [
    comentario || null,
    comentario ? nomeUsuario : null,
    req.params.id
  ])
  const [[pi]] = await banco.query('SELECT numero_pi, cliente FROM pedidos WHERE id = ?', [req.params.id])
  if (pi && comentario && comentario.trim()) {
    enviarPush(
      `Comentário na PI ${pi.numero_pi}`,
      `${nomeUsuario}: ${comentario.slice(0, 80)}`,
      '/HTML/estoque/embarques.html',
      `comentario_emb_${pi.numero_pi}`
    ).catch(() => {})
    enviarEmail(
      `Cobrança de embarque — PI ${pi.numero_pi}`,
      `<h2 style="color:#1565C0;margin:0 0 16px">Comentário do Admin — Data de Embarque</h2><table style="width:100%;border-collapse:collapse;"><tr><td style="padding:8px 0;color:#8a6a6a;width:140px">PI</td><td style="padding:8px 0;font-weight:600">${pi.numero_pi}</td></tr>
 ${pi.cliente ? `<tr><td style="padding:8px 0;color:#8a6a6a">Cliente</td><td style="padding:8px 0;font-weight:600">${pi.cliente}</td></tr>` : ''}
 <tr><td style="padding:8px 0;color:#8a6a6a">Comentário</td><td style="padding:8px 0;font-weight:600">${comentario}</td></tr></table><p style="margin:16px 0 0;color:#1565C0;font-weight:600">Gerente: por favor, defina a data de embarque desta PI.</p>`,
      ['admin', 'gerente_producao']
    )
  }
  res.json({ ok: true })
})

rotas.patch('/api/pedidos/:id/concluir', autenticar(['admin']), async (req, res) => {
  const { concluida } = req.body
  await banco.query('UPDATE pedidos SET concluida = ? WHERE id = ?', [concluida ? 1 : 0, req.params.id])
  res.json({ ok: true })
})

rotas.delete('/api/pedidos/:id', autenticar(['admin']), async (req, res) => {
  await banco.query('DELETE FROM pedidos WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

rotas.patch('/api/produtos/:id/quantidade', autenticar(['admin']), async (req, res) => {
  const { quantidade } = req.body
  await banco.query('UPDATE produtos_pi SET quantidade = ? WHERE id = ?', [quantidade, req.params.id])
  res.json({ ok: true })
})

module.exports = rotas
