const express = require('express')
const { banco, emTransacao } = require('../config/banco')
const { autenticar } = require('../middlewares/autenticacao')

const rotas = express.Router()

const UNIDADES_PERMITIDAS = ['CARTONS', 'CANS', 'PACKS']
const PADRAO_IMAGEM = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/
const LIMITE_ASSINATURA = 2 * 1024 * 1024

async function inicializarLotCodeList() {
  try {
    await banco.query(`CREATE TABLE IF NOT EXISTS lot_code_responsaveis (
      id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(160) NOT NULL, cargo VARCHAR(120) NOT NULL,
      assinatura MEDIUMTEXT NULL, criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
    await banco.query(`CREATE TABLE IF NOT EXISTS lot_code_list (
      id INT AUTO_INCREMENT PRIMARY KEY, fatura VARCHAR(60) NOT NULL, importador_nome VARCHAR(200) NOT NULL,
      importador_endereco VARCHAR(400), importador_att VARCHAR(160), data_documento DATE NOT NULL,
      responsavel_id INT NULL, criado_por VARCHAR(160), criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_lcl_fatura (fatura))`)
    await banco.query(`CREATE TABLE IF NOT EXISTS lot_code_list_itens (
      id INT AUTO_INCREMENT PRIMARY KEY, lista_id INT NOT NULL, ordem INT DEFAULT 0, descricao VARCHAR(300) NOT NULL,
      unidade VARCHAR(20) NOT NULL DEFAULT 'CARTONS', INDEX(lista_id))`)
    await banco.query(`CREATE TABLE IF NOT EXISTS lot_code_list_lotes (
      id INT AUTO_INCREMENT PRIMARY KEY, item_id INT NOT NULL, ordem INT DEFAULT 0, lote VARCHAR(80) NOT NULL,
      caixas INT NOT NULL, validade DATE NOT NULL, INDEX(item_id))`)
  } catch (e) {
    console.error('Erro init lot code list:', e.message)
  }
}

setTimeout(inicializarLotCodeList, 3000)

const tratar = (funcao) => (req, res, next) => Promise.resolve(funcao(req, res, next)).catch(next)

function textoLimpo(valor, limite) {
  return String(valor == null ? '' : valor)
    .trim()
    .slice(0, limite)
}

function dataValida(valor) {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(valor || ''))
  if (!partes) return false
  const ano = Number(partes[1])
  const mes = Number(partes[2])
  const dia = Number(partes[3])
  if (ano < 2000 || ano > 2100) return false
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia
}

function inteiroPositivo(valor) {
  const digitos = String(valor == null ? '' : valor).replace(/\./g, '')
  if (!/^\d{1,9}$/.test(digitos)) return null
  const numero = Number(digitos)
  return numero > 0 ? numero : null
}

function identificadorOpcional(valor) {
  const numero = Number(valor)
  return Number.isInteger(numero) && numero > 0 ? numero : null
}

function validarLista(corpo) {
  const b = corpo || {}
  const lista = {
    fatura: textoLimpo(b.fatura, 60),
    importador_nome: textoLimpo(b.importador_nome, 200),
    importador_endereco: textoLimpo(b.importador_endereco, 400) || null,
    importador_att: textoLimpo(b.importador_att, 160) || null,
    data_documento: textoLimpo(b.data_documento, 10),
    responsavel_id: identificadorOpcional(b.responsavel_id)
  }
  if (!lista.fatura) return { erro: 'Informe o número da invoice.' }
  if (!lista.importador_nome) return { erro: 'Informe o nome do importador.' }
  if (!dataValida(lista.data_documento)) return { erro: 'Informe uma data do documento válida.' }

  const itens = []
  const recebidos = Array.isArray(b.itens) ? b.itens : []
  for (const bruto of recebidos) {
    const item = bruto || {}
    const descricao = textoLimpo(item.descricao, 300)
    const lotesRecebidos = (Array.isArray(item.lotes) ? item.lotes : []).filter(
      (l) => l && (textoLimpo(l.lote, 80) || textoLimpo(l.caixas, 12) || textoLimpo(l.validade, 10))
    )
    if (!descricao && !lotesRecebidos.length) continue
    if (!descricao) return { erro: 'Informe a descrição de todos os produtos.' }
    const unidade = textoLimpo(item.unidade, 20).toUpperCase() || 'CARTONS'
    if (!UNIDADES_PERMITIDAS.includes(unidade)) return { erro: `Unidade inválida no produto "${descricao}".` }
    if (!lotesRecebidos.length) return { erro: `Informe ao menos um lote para o produto "${descricao}".` }

    const lotes = []
    const numerosUsados = new Set()
    for (const l of lotesRecebidos) {
      const numero = textoLimpo(l.lote, 80)
      const caixas = inteiroPositivo(l.caixas)
      const validade = textoLimpo(l.validade, 10)
      if (!numero) return { erro: `Informe o número do lote em todas as linhas do produto "${descricao}".` }
      if (caixas === null) {
        return { erro: `Informe a quantidade de caixas (número inteiro maior que zero) do lote ${numero}.` }
      }
      if (!dataValida(validade)) return { erro: `Informe uma data de validade válida para o lote ${numero}.` }
      const chave = numero.toLowerCase()
      if (numerosUsados.has(chave)) return { erro: `O lote ${numero} está repetido no produto "${descricao}".` }
      numerosUsados.add(chave)
      lotes.push({ lote: numero, caixas, validade })
    }
    itens.push({ descricao, unidade, lotes })
  }
  if (!itens.length) return { erro: 'Informe ao menos um produto com lote.' }
  return { lista, itens }
}

function validarResponsavel(corpo, criacao) {
  const b = corpo || {}
  const dados = { nome: textoLimpo(b.nome, 160), cargo: textoLimpo(b.cargo, 120) }
  if (!dados.nome) return { erro: 'Informe o nome do responsável.' }
  if (!dados.cargo) return { erro: 'Informe o cargo do responsável.' }
  if (b.assinatura === undefined && !criacao) return { dados }
  if (b.assinatura === undefined || b.assinatura === null || b.assinatura === '') {
    dados.assinatura = null
    return { dados }
  }
  const imagem = String(b.assinatura)
  if (imagem.length > LIMITE_ASSINATURA) return { erro: 'A imagem da assinatura é grande demais.' }
  if (!PADRAO_IMAGEM.test(imagem)) return { erro: 'A assinatura deve ser uma imagem PNG ou JPEG.' }
  dados.assinatura = imagem
  return { dados }
}

async function salvarItens(conexao, listaId, itens) {
  const [antigos] = await conexao.query('SELECT id FROM lot_code_list_itens WHERE lista_id = ?', [listaId])
  if (antigos.length) {
    await conexao.query('DELETE FROM lot_code_list_lotes WHERE item_id IN (?)', [antigos.map((i) => i.id)])
  }
  await conexao.query('DELETE FROM lot_code_list_itens WHERE lista_id = ?', [listaId])
  for (let i = 0; i < itens.length; i++) {
    const item = itens[i]
    const [resultado] = await conexao.query(
      'INSERT INTO lot_code_list_itens (lista_id, ordem, descricao, unidade) VALUES (?,?,?,?)',
      [listaId, i + 1, item.descricao, item.unidade]
    )
    for (let j = 0; j < item.lotes.length; j++) {
      const lote = item.lotes[j]
      await conexao.query('INSERT INTO lot_code_list_lotes (item_id, ordem, lote, caixas, validade) VALUES (?,?,?,?,?)', [
        resultado.insertId,
        j + 1,
        lote.lote,
        lote.caixas,
        lote.validade
      ])
    }
  }
}

async function responsavelExiste(id) {
  if (!id) return true
  const [linhas] = await banco.query('SELECT id FROM lot_code_responsaveis WHERE id = ?', [id])
  return linhas.length > 0
}

rotas.get(
  '/api/lot-code-list',
  autenticar(),
  tratar(async (req, res) => {
    const [linhas] = await banco.query(`
      SELECT l.id, l.fatura, l.importador_nome, DATE_FORMAT(l.data_documento, '%Y-%m-%d') AS data_documento,
        COUNT(DISTINCT i.id) AS total_produtos, COALESCE(SUM(t.caixas), 0) AS total_caixas
      FROM lot_code_list l
      LEFT JOIN lot_code_list_itens i ON i.lista_id = l.id
      LEFT JOIN lot_code_list_lotes t ON t.item_id = i.id
      GROUP BY l.id, l.fatura, l.importador_nome, l.data_documento
      ORDER BY l.id DESC LIMIT 300`)
    res.json(
      linhas.map((l) => ({
        ...l,
        total_produtos: Number(l.total_produtos) || 0,
        total_caixas: Number(l.total_caixas) || 0
      }))
    )
  })
)

rotas.get(
  '/api/lot-code-list/:id',
  autenticar(),
  tratar(async (req, res) => {
    const [[lista]] = await banco.query(
      `SELECT l.id, l.fatura, l.importador_nome, l.importador_endereco, l.importador_att,
        DATE_FORMAT(l.data_documento, '%Y-%m-%d') AS data_documento, l.responsavel_id,
        r.nome AS responsavel_nome, r.cargo AS responsavel_cargo, r.assinatura AS responsavel_assinatura
      FROM lot_code_list l LEFT JOIN lot_code_responsaveis r ON r.id = l.responsavel_id WHERE l.id = ?`,
      [req.params.id]
    )
    if (!lista) return res.status(404).json({ erro: 'Não encontrada.' })
    const [itens] = await banco.query(
      'SELECT id, ordem, descricao, unidade FROM lot_code_list_itens WHERE lista_id = ? ORDER BY ordem, id',
      [lista.id]
    )
    let lotes = []
    if (itens.length) {
      const [linhas] = await banco.query(
        `SELECT id, item_id, ordem, lote, caixas, DATE_FORMAT(validade, '%Y-%m-%d') AS validade
        FROM lot_code_list_lotes WHERE item_id IN (?) ORDER BY ordem, id`,
        [itens.map((i) => i.id)]
      )
      lotes = linhas
    }
    const { responsavel_nome, responsavel_cargo, responsavel_assinatura, ...cabecalho } = lista
    res.json({
      ...cabecalho,
      responsavel: lista.responsavel_id
        ? { id: lista.responsavel_id, nome: responsavel_nome, cargo: responsavel_cargo, assinatura: responsavel_assinatura }
        : null,
      itens: itens.map((i) => ({ ...i, lotes: lotes.filter((l) => l.item_id === i.id) }))
    })
  })
)

rotas.post(
  '/api/lot-code-list',
  autenticar(),
  tratar(async (req, res) => {
    const validado = validarLista(req.body)
    if (validado.erro) return res.status(400).json({ erro: validado.erro })
    const { lista, itens } = validado
    if (!(await responsavelExiste(lista.responsavel_id))) return res.status(400).json({ erro: 'Responsável não encontrado.' })
    const id = await emTransacao(async (conexao) => {
      const [resultado] = await conexao.query(
        `INSERT INTO lot_code_list (fatura, importador_nome, importador_endereco, importador_att, data_documento,
          responsavel_id, criado_por) VALUES (?,?,?,?,?,?,?)`,
        [
          lista.fatura,
          lista.importador_nome,
          lista.importador_endereco,
          lista.importador_att,
          lista.data_documento,
          lista.responsavel_id,
          req.usuario.nome || null
        ]
      )
      await salvarItens(conexao, resultado.insertId, itens)
      return resultado.insertId
    })
    res.json({ id })
  })
)

rotas.put(
  '/api/lot-code-list/:id',
  autenticar(),
  tratar(async (req, res) => {
    const validado = validarLista(req.body)
    if (validado.erro) return res.status(400).json({ erro: validado.erro })
    const { lista, itens } = validado
    const [existente] = await banco.query('SELECT id FROM lot_code_list WHERE id = ?', [req.params.id])
    if (!existente.length) return res.status(404).json({ erro: 'Não encontrada.' })
    if (!(await responsavelExiste(lista.responsavel_id))) return res.status(400).json({ erro: 'Responsável não encontrado.' })
    await emTransacao(async (conexao) => {
      await conexao.query(
        `UPDATE lot_code_list SET fatura = ?, importador_nome = ?, importador_endereco = ?, importador_att = ?,
          data_documento = ?, responsavel_id = ? WHERE id = ?`,
        [
          lista.fatura,
          lista.importador_nome,
          lista.importador_endereco,
          lista.importador_att,
          lista.data_documento,
          lista.responsavel_id,
          req.params.id
        ]
      )
      await salvarItens(conexao, req.params.id, itens)
    })
    res.json({ ok: true })
  })
)

rotas.delete(
  '/api/lot-code-list/:id',
  autenticar(),
  tratar(async (req, res) => {
    await emTransacao(async (conexao) => {
      const [itens] = await conexao.query('SELECT id FROM lot_code_list_itens WHERE lista_id = ?', [req.params.id])
      if (itens.length) {
        await conexao.query('DELETE FROM lot_code_list_lotes WHERE item_id IN (?)', [itens.map((i) => i.id)])
      }
      await conexao.query('DELETE FROM lot_code_list_itens WHERE lista_id = ?', [req.params.id])
      await conexao.query('DELETE FROM lot_code_list WHERE id = ?', [req.params.id])
    })
    res.json({ ok: true })
  })
)

rotas.get(
  '/api/lot-code-responsaveis',
  autenticar(),
  tratar(async (req, res) => {
    const [linhas] = await banco.query(
      'SELECT id, nome, cargo, (assinatura IS NOT NULL) AS tem_assinatura FROM lot_code_responsaveis ORDER BY nome'
    )
    res.json(linhas.map((r) => ({ ...r, tem_assinatura: Number(r.tem_assinatura) === 1 })))
  })
)

rotas.get(
  '/api/lot-code-responsaveis/:id',
  autenticar(),
  tratar(async (req, res) => {
    const [[responsavel]] = await banco.query(
      'SELECT id, nome, cargo, assinatura FROM lot_code_responsaveis WHERE id = ?',
      [req.params.id]
    )
    if (!responsavel) return res.status(404).json({ erro: 'Não encontrado.' })
    res.json(responsavel)
  })
)

rotas.post(
  '/api/lot-code-responsaveis',
  autenticar(),
  tratar(async (req, res) => {
    const validado = validarResponsavel(req.body, true)
    if (validado.erro) return res.status(400).json({ erro: validado.erro })
    const { nome, cargo, assinatura } = validado.dados
    const [resultado] = await banco.query(
      'INSERT INTO lot_code_responsaveis (nome, cargo, assinatura) VALUES (?,?,?)',
      [nome, cargo, assinatura]
    )
    res.json({ id: resultado.insertId })
  })
)

rotas.put(
  '/api/lot-code-responsaveis/:id',
  autenticar(),
  tratar(async (req, res) => {
    const validado = validarResponsavel(req.body, false)
    if (validado.erro) return res.status(400).json({ erro: validado.erro })
    const [existente] = await banco.query('SELECT id FROM lot_code_responsaveis WHERE id = ?', [req.params.id])
    if (!existente.length) return res.status(404).json({ erro: 'Não encontrado.' })
    const { nome, cargo, assinatura } = validado.dados
    if (assinatura === undefined) {
      await banco.query('UPDATE lot_code_responsaveis SET nome = ?, cargo = ? WHERE id = ?', [nome, cargo, req.params.id])
    } else {
      await banco.query('UPDATE lot_code_responsaveis SET nome = ?, cargo = ?, assinatura = ? WHERE id = ?', [
        nome,
        cargo,
        assinatura,
        req.params.id
      ])
    }
    res.json({ ok: true })
  })
)

rotas.delete(
  '/api/lot-code-responsaveis/:id',
  autenticar(),
  tratar(async (req, res) => {
    const [[uso]] = await banco.query('SELECT COUNT(*) AS total FROM lot_code_list WHERE responsavel_id = ?', [
      req.params.id
    ])
    if (Number(uso.total) > 0) {
      return res.status(400).json({ erro: `Este responsável está em ${uso.total} Lot Code List(s) e não pode ser excluído.` })
    }
    await banco.query('DELETE FROM lot_code_responsaveis WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  })
)

module.exports = rotas
