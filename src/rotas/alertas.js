const express = require('express')
const { TODOS_PERFIS, autenticar } = require('../middlewares/autenticacao')
const { banco } = require('../config/banco')
const { SQL_DECLARACAO_PENDENTE, SQL_EMBARQUES_PENDENTES } = require('../rotinas/alertas-diarios')

const rotas = express.Router()

rotas.get('/api/alertas/declaracao', autenticar(TODOS_PERFIS), async (req, res) => {
  const [rows] = await banco.query(SQL_DECLARACAO_PENDENTE)
  res.json(rows)
})

rotas.get('/api/pendencias', autenticar(TODOS_PERFIS), async (req, res) => {
  try {
    const [decl] = await banco.query(SQL_DECLARACAO_PENDENTE)
    const [emb] = await banco.query(SQL_EMBARQUES_PENDENTES)
    const [[ped]] = await banco.query(`SELECT COUNT(*) as n FROM demandas WHERE status = 'pendente'`)
    const [[atr]] = await banco.query(
      `SELECT COUNT(*) as n FROM compras WHERE status <> 'recebido' AND data_prevista IS NOT NULL AND data_prevista < CURDATE()`
    )
    res.json({
      estoqueNaoDeclarado: decl.length,
      embarquesPendentes: emb.length,
      pedidosCompra: ped.n,
      comprasAtrasadas: atr.n
    })
  } catch (e) {
    res.json({ estoqueNaoDeclarado: 0, embarquesPendentes: 0, pedidosCompra: 0, comprasAtrasadas: 0 })
  }
})

module.exports = rotas
