const express = require('express')
const { autenticarContabil } = require('../middlewares/autenticacao')
const { banco } = require('../config/banco')

const rotas = express.Router()

const NOMES_MESES_EC = [
  '',
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro'
]

const MODULOS_EC = {
  exterior: {
    tabela: 'ec_lanc_exterior',
    col: 'cliente_id',
    ent: 'ec_clientes',
    aumenta: 'debito',
    diminui: 'baixa',
    temFatura: true
  },
  adiant_clientes: {
    tabela: 'ec_lanc_adiant_clientes',
    col: 'cliente_id',
    ent: 'ec_clientes',
    aumenta: 'credito',
    diminui: 'debito',
    temFatura: false
  },
  adiant_fornecedores: {
    tabela: 'ec_lanc_adiant_fornecedores',
    col: 'fornecedor_id',
    ent: 'ec_fornecedores',
    aumenta: 'debito',
    diminui: 'pagamento',
    temFatura: false
  }
}

function configuracaoModulo(modulo) {
  return MODULOS_EC[modulo] || null
}

rotas.get('/api/ec/meses', autenticarContabil(), async (req, res) => {
  const [rows] = await banco.query('SELECT * FROM ec_meses ORDER BY ano DESC, mes DESC')
  res.json(rows)
})

rotas.post('/api/ec/meses', autenticarContabil(), async (req, res) => {
  const ano = parseInt(req.body.ano),
    mes = parseInt(req.body.mes)
  if (!(ano > 2000) || !(mes >= 1 && mes <= 12)) return res.status(400).json({ erro: 'Ano/mês inválido.' })
  const [ex] = await banco.query('SELECT id FROM ec_meses WHERE ano = ? AND mes = ?', [ano, mes])
  if (ex.length) return res.json({ id: ex[0].id })
  const [r] = await banco.query('INSERT INTO ec_meses (ano, mes, nome) VALUES (?, ?, ?)', [
    ano,
    mes,
    `${NOMES_MESES_EC[mes]} ${ano}`
  ])
  res.json({ id: r.insertId })
})

rotas.delete('/api/ec/meses/:id', autenticarContabil(), async (req, res) => {
  await banco.query('DELETE FROM ec_meses WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

rotas.get('/api/ec/entidades', autenticarContabil(), async (req, res) => {
  const tabela = req.query.tipo === 'fornecedores' ? 'ec_fornecedores' : 'ec_clientes'
  const [rows] = await banco.query(`SELECT * FROM ${tabela} ORDER BY nome`)
  res.json(rows)
})

rotas.post('/api/ec/entidades', autenticarContabil(), async (req, res) => {
  const nome = (req.body.nome || '').trim()
  if (!nome) return res.status(400).json({ erro: 'Informe o nome.' })
  if (req.body.tipo === 'fornecedores') {
    await banco.query('INSERT IGNORE INTO ec_fornecedores (nome) VALUES (?)', [nome])
  } else {
    await banco.query('INSERT IGNORE INTO ec_clientes (nome, pais) VALUES (?, ?)', [
      nome,
      (req.body.pais || '').trim() || null
    ])
  }
  res.json({ ok: true })
})

rotas.patch('/api/ec/entidades/:id', autenticarContabil(), async (req, res) => {
  const tabela = req.body.tipo === 'fornecedores' ? 'ec_fornecedores' : 'ec_clientes'
  await banco.query(`UPDATE ${tabela} SET ativo = 1 - ativo WHERE id = ?`, [req.params.id])
  res.json({ ok: true })
})

rotas.get('/api/ec/saldos', autenticarContabil(), async (req, res) => {
  const cfg = configuracaoModulo(req.query.modulo)
  const mesId = parseInt(req.query.mesId)
  if (!cfg || !mesId) return res.status(400).json({ erro: 'Parâmetros inválidos.' })
  const [[mes]] = await banco.query('SELECT * FROM ec_meses WHERE id = ?', [mesId])
  if (!mes) return res.status(404).json({ erro: 'Período não encontrado.' })
  const chave = mes.ano * 12 + mes.mes
  const [entidades] = await banco.query(`SELECT * FROM ${cfg.ent} WHERE ativo = 1 ORDER BY nome`)
  const linhas = []
  for (const ent of entidades) {
    const [[ant]] = await banco.query(
      `SELECT COALESCE(SUM(CASE WHEN l.tipo = ? THEN l.valor ELSE 0 END),0) - COALESCE(SUM(CASE WHEN l.tipo = ? THEN l.valor ELSE 0 END),0) AS s
       FROM ${cfg.tabela} l JOIN ec_meses m ON m.id = l.mes_id
       WHERE l.${cfg.col} = ? AND (m.ano*12+m.mes) < ?`,
      [cfg.aumenta, cfg.diminui, ent.id, chave]
    )
    const [[mov]] = await banco.query(
      `SELECT COALESCE(SUM(CASE WHEN tipo = ? THEN valor ELSE 0 END),0) AS aumenta,
              COALESCE(SUM(CASE WHEN tipo = ? THEN valor ELSE 0 END),0) AS diminui
       FROM ${cfg.tabela} WHERE ${cfg.col} = ? AND mes_id = ?`,
      [cfg.aumenta, cfg.diminui, ent.id, mesId]
    )
    const anterior = Number(ant.s) || 0,
      aumenta = Number(mov.aumenta) || 0,
      diminui = Number(mov.diminui) || 0
    linhas.push({
      id: ent.id,
      nome: ent.nome,
      pais: ent.pais || '',
      anterior,
      aumenta,
      diminui,
      atual: anterior + aumenta - diminui
    })
  }
  res.json({ mes, temFatura: cfg.temFatura, linhas })
})

rotas.get('/api/ec/lancamentos', autenticarContabil(), async (req, res) => {
  const cfg = configuracaoModulo(req.query.modulo)
  const mesId = parseInt(req.query.mesId),
    entidadeId = parseInt(req.query.entidadeId)
  if (!cfg || !mesId || !entidadeId) return res.status(400).json({ erro: 'Parâmetros inválidos.' })
  const [rows] = await banco.query(
    `SELECT * FROM ${cfg.tabela} WHERE ${cfg.col} = ? AND mes_id = ? ORDER BY data_lanc, id`,
    [entidadeId, mesId]
  )
  res.json({ temFatura: cfg.temFatura, lancamentos: rows })
})

rotas.post('/api/ec/lancamentos', autenticarContabil(), async (req, res) => {
  const cfg = configuracaoModulo(req.body.modulo)
  const mesId = parseInt(req.body.mesId),
    entidadeId = parseInt(req.body.entidadeId)
  const tipo = req.body.tipo,
    data = req.body.data_lanc
  const valor = parseFloat(String(req.body.valor || '').replace(',', '.'))
  if (!cfg || !mesId || !entidadeId || !data || !(valor >= 0) || ![cfg.aumenta, cfg.diminui].includes(tipo)) {
    return res.status(400).json({ erro: 'Preencha tipo, data e valor corretamente.' })
  }
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

rotas.delete('/api/ec/lancamentos/:modulo/:id', autenticarContabil(), async (req, res) => {
  const cfg = configuracaoModulo(req.params.modulo)
  if (!cfg) return res.status(400).json({ erro: 'Módulo inválido.' })
  await banco.query(`DELETE FROM ${cfg.tabela} WHERE id = ?`, [req.params.id])
  res.json({ ok: true })
})

module.exports = rotas
