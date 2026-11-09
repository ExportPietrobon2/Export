const express = require('express')
const { autenticar } = require('../middlewares/autenticacao')
const { banco } = require('../config/banco')
const {
  MODULOS_EC,
  garantirMesesAteHoje,
  garantirMes,
  saldosDoPeriodo,
  lancamentosDaEntidade
} = require('../servicos/financeiro')

const rotas = express.Router()

async function mesPorId(id) {
  const [[mes]] = await banco.query('SELECT * FROM ec_meses WHERE id = ?', [id])
  return mes
}

rotas.get('/api/ec/meses', autenticar(), async (req, res) => {
  await garantirMesesAteHoje()
  const [rows] = await banco.query('SELECT * FROM ec_meses ORDER BY ano DESC, mes DESC')
  res.json(rows)
})

rotas.post('/api/ec/meses', autenticar(), async (req, res) => {
  const ano = parseInt(req.body.ano)
  const mes = parseInt(req.body.mes)
  if (!(ano > 2000) || !(mes >= 1 && mes <= 12)) return res.status(400).json({ erro: 'Ano/mês inválido.' })
  res.json({ id: await garantirMes(ano, mes) })
})

rotas.get('/api/ec/saldos', autenticar(), async (req, res) => {
  const modulo = req.query.modulo
  if (!MODULOS_EC[modulo]) return res.status(400).json({ erro: 'Módulo inválido.' })
  const mes = await mesPorId(parseInt(req.query.mesId))
  if (!mes) return res.status(404).json({ erro: 'Período não encontrado.' })
  const r = await saldosDoPeriodo(modulo, mes.ano, mes.mes)
  res.json({ mes, ...r })
})

rotas.get('/api/ec/lancamentos', autenticar(), async (req, res) => {
  const modulo = req.query.modulo
  const cfg = MODULOS_EC[modulo]
  const mes = await mesPorId(parseInt(req.query.mesId))
  const entidadeId = parseInt(req.query.entidadeId)
  if (!cfg || !mes || !entidadeId) return res.status(400).json({ erro: 'Parâmetros inválidos.' })
  const lancamentos = await lancamentosDaEntidade(modulo, mes.ano, mes.mes, entidadeId)
  res.json({ temFatura: cfg.temFatura, lancamentos })
})

rotas.post('/api/ec/lancamentos', autenticar(), async (req, res) => {
  const cfg = MODULOS_EC[req.body.modulo]
  const entidadeId = parseInt(req.body.entidadeId)
  const tipo = req.body.tipo
  const data = req.body.data_lanc
  const valor = parseFloat(
    String(req.body.valor || '')
      .replace(/\./g, '')
      .replace(',', '.')
  )
  if (!cfg || !entidadeId || !data || !(valor > 0) || ![cfg.aumenta, cfg.diminui].includes(tipo)) {
    return res.status(400).json({ erro: 'Preencha tipo, data e valor corretamente.' })
  }
  const [ano, mes] = String(data).split('-').map(Number)
  const mesId = await garantirMes(ano, mes)
  const obs = (req.body.observacao || '').trim() || null
  if (cfg.temFatura) {
    await banco.query(
      `INSERT INTO ${cfg.tabela} (mes_id, ${cfg.col}, tipo, data_lanc, valor, fatura, observacao) VALUES (?,?,?,?,?,?,?)`,
      [mesId, entidadeId, tipo, data, valor, (req.body.fatura || '').trim() || null, obs]
    )
  } else {
    await banco.query(
      `INSERT INTO ${cfg.tabela} (mes_id, ${cfg.col}, tipo, data_lanc, valor, observacao) VALUES (?,?,?,?,?,?)`,
      [mesId, entidadeId, tipo, data, valor, obs]
    )
  }
  res.json({ ok: true })
})

rotas.delete('/api/ec/lancamentos/:modulo/:id', autenticar(), async (req, res) => {
  const cfg = MODULOS_EC[req.params.modulo]
  if (!cfg) return res.status(400).json({ erro: 'Módulo inválido.' })
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ erro: 'Lançamento automático: altere na origem (Faturamento ou Importações).' })
  }
  await banco.query(`DELETE FROM ${cfg.tabela} WHERE id = ?`, [req.params.id])
  res.json({ ok: true })
})

module.exports = rotas
