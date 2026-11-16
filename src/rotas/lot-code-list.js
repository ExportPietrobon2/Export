const express = require('express')
const { banco, emTransacao } = require('../config/banco')
const { autenticar } = require('../middlewares/autenticacao')
const { gerarWord } = require('../servicos/lot-code-word')

const rotas = express.Router()

const UNIDADES_PERMITIDAS = ['CARTONS', 'CANS', 'PACKS']
const IDIOMAS_PERMITIDOS = ['EN', 'ES']
const TIPOS_DATA_PERMITIDOS = ['VALIDADE', 'FABRICACAO', 'AMBAS']

async function garantirColuna(tabela, coluna, definicao) {
  const [existente] = await banco.query(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [tabela, coluna]
  )
  if (!existente.length) await banco.query(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`)
}

async function inicializarLotCodeList() {
  try {
    await banco.query(`CREATE TABLE IF NOT EXISTS lot_code_list (
      id INT AUTO_INCREMENT PRIMARY KEY, fatura VARCHAR(60) NOT NULL, importador_nome VARCHAR(200) NOT NULL,
      importador_endereco VARCHAR(400), importador_att VARCHAR(160), data_documento DATE NOT NULL,
      idioma VARCHAR(2) NOT NULL DEFAULT 'EN', tipo_data VARCHAR(10) NOT NULL DEFAULT 'VALIDADE',
      criado_por VARCHAR(160), criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_lcl_fatura (fatura))`)
    await banco.query(`CREATE TABLE IF NOT EXISTS lot_code_list_itens (
      id INT AUTO_INCREMENT PRIMARY KEY, lista_id INT NOT NULL, ordem INT DEFAULT 0, descricao VARCHAR(300) NOT NULL,
      unidade VARCHAR(20) NOT NULL DEFAULT 'CARTONS', INDEX(lista_id))`)
    await banco.query(`CREATE TABLE IF NOT EXISTS lot_code_list_lotes (
      id INT AUTO_INCREMENT PRIMARY KEY, item_id INT NOT NULL, ordem INT DEFAULT 0, lote VARCHAR(80) NOT NULL,
      caixas INT NOT NULL, fabricacao DATE NULL, validade DATE NULL, INDEX(item_id))`)
    await garantirColuna('lot_code_list', 'idioma', "VARCHAR(2) NOT NULL DEFAULT 'EN'")
    await garantirColuna('lot_code_list', 'tipo_data', "VARCHAR(10) NOT NULL DEFAULT 'VALIDADE'")
    await garantirColuna('lot_code_list_lotes', 'fabricacao', 'DATE NULL')
    await banco.query('ALTER TABLE lot_code_list_lotes MODIFY validade DATE NULL')
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

function validarLista(corpo) {
  const b = corpo || {}
  const lista = {
    fatura: textoLimpo(b.fatura, 60),
    importador_nome: textoLimpo(b.importador_nome, 200),
    importador_endereco: textoLimpo(b.importador_endereco, 400) || null,
    importador_att: textoLimpo(b.importador_att, 160) || null,
    data_documento: textoLimpo(b.data_documento, 10),
    idioma: textoLimpo(b.idioma, 2).toUpperCase() || 'EN',
    tipo_data: textoLimpo(b.tipo_data, 10).toUpperCase() || 'VALIDADE'
  }
  if (!lista.fatura) return { erro: 'Informe o número da invoice.' }
  if (!lista.importador_nome) return { erro: 'Informe o nome do importador.' }
  if (!dataValida(lista.data_documento)) return { erro: 'Informe uma data do documento válida.' }
  if (!IDIOMAS_PERMITIDOS.includes(lista.idioma)) return { erro: 'Idioma inválido.' }
  if (!TIPOS_DATA_PERMITIDOS.includes(lista.tipo_data)) return { erro: 'Tipo de data inválido.' }
  const exigeFabricacao = lista.tipo_data !== 'VALIDADE'
  const exigeValidade = lista.tipo_data !== 'FABRICACAO'

  const itens = []
  const recebidos = Array.isArray(b.itens) ? b.itens : []
  for (const bruto of recebidos) {
    const item = bruto || {}
    const descricao = textoLimpo(item.descricao, 300)
    const lotesRecebidos = (Array.isArray(item.lotes) ? item.lotes : []).filter(
      (l) =>
        l &&
        (textoLimpo(l.lote, 80) ||
          textoLimpo(l.caixas, 12) ||
          (exigeValidade && textoLimpo(l.validade, 10)) ||
          (exigeFabricacao && textoLimpo(l.fabricacao, 10)))
    )
    if (!descricao && !lotesRecebidos.length) continue
    if (!descricao) return { erro: 'Informe a descrição de todos os produtos.' }
    const unidade = textoLimpo(item.unidade, 20).toUpperCase() || 'CARTONS'
    if (!UNIDADES_PERMITIDAS.includes(unidade)) return { erro: `Unidade inválida no produto "${descricao}".` }

    const lotes = []
    const numerosUsados = new Set()
    for (const l of lotesRecebidos) {
      const numero = textoLimpo(l.lote, 80)
      const caixas = inteiroPositivo(l.caixas)
      const validadeInformada = textoLimpo(l.validade, 10)
      const fabricacaoInformada = textoLimpo(l.fabricacao, 10)
      if (!numero) return { erro: `Informe o número do lote em todas as linhas do produto "${descricao}".` }
      if (caixas === null) {
        return { erro: `Informe a quantidade de caixas (número inteiro maior que zero) do lote ${numero}.` }
      }
      if (exigeFabricacao && !dataValida(fabricacaoInformada)) {
        return { erro: `Informe uma data de fabricação válida para o lote ${numero}.` }
      }
      if (exigeValidade && !dataValida(validadeInformada)) {
        return { erro: `Informe uma data de validade válida para o lote ${numero}.` }
      }
      const fabricacao = exigeFabricacao ? fabricacaoInformada : null
      const validade = exigeValidade ? validadeInformada : null
      if (fabricacao && validade && validade < fabricacao) {
        return { erro: `A validade do lote ${numero} é anterior à data de fabricação.` }
      }
      const chave = numero.toLowerCase()
      if (numerosUsados.has(chave)) return { erro: `O lote ${numero} está repetido no produto "${descricao}".` }
      numerosUsados.add(chave)
      lotes.push({ lote: numero, caixas, fabricacao, validade })
    }
    itens.push({ descricao, unidade, lotes })
  }
  if (!itens.length) return { erro: 'Informe ao menos um produto.' }
  return { lista, itens }
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
      await conexao.query(
        'INSERT INTO lot_code_list_lotes (item_id, ordem, lote, caixas, fabricacao, validade) VALUES (?,?,?,?,?,?)',
        [resultado.insertId, j + 1, lote.lote, lote.caixas, lote.fabricacao, lote.validade]
      )
    }
  }
}

rotas.get(
  '/api/lot-code-list',
  autenticar(),
  tratar(async (req, res) => {
    const [linhas] = await banco.query(`
      SELECT l.id, l.fatura, l.importador_nome, l.idioma, DATE_FORMAT(l.data_documento, '%Y-%m-%d') AS data_documento,
        COUNT(DISTINCT i.id) AS total_produtos, COALESCE(SUM(t.caixas), 0) AS total_caixas
      FROM lot_code_list l
      LEFT JOIN lot_code_list_itens i ON i.lista_id = l.id
      LEFT JOIN lot_code_list_lotes t ON t.item_id = i.id
      GROUP BY l.id, l.fatura, l.importador_nome, l.idioma, l.data_documento
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

async function obterListaCompleta(id) {
  const [[lista]] = await banco.query(
    `SELECT l.id, l.fatura, l.importador_nome, l.importador_endereco, l.importador_att, l.idioma, l.tipo_data,
      DATE_FORMAT(l.data_documento, '%Y-%m-%d') AS data_documento
    FROM lot_code_list l WHERE l.id = ?`,
    [id]
  )
  if (!lista) return null
  const [itens] = await banco.query(
    'SELECT id, ordem, descricao, unidade FROM lot_code_list_itens WHERE lista_id = ? ORDER BY ordem, id',
    [lista.id]
  )
  let lotes = []
  if (itens.length) {
    const [linhas] = await banco.query(
      `SELECT id, item_id, ordem, lote, caixas, DATE_FORMAT(fabricacao, '%Y-%m-%d') AS fabricacao,
        DATE_FORMAT(validade, '%Y-%m-%d') AS validade
      FROM lot_code_list_lotes WHERE item_id IN (?) ORDER BY ordem, id`,
      [itens.map((i) => i.id)]
    )
    lotes = linhas
  }
  return { ...lista, itens: itens.map((i) => ({ ...i, lotes: lotes.filter((l) => l.item_id === i.id) })) }
}

rotas.get(
  '/api/lot-code-list/:id',
  autenticar(),
  tratar(async (req, res) => {
    const lista = await obterListaCompleta(req.params.id)
    if (!lista) return res.status(404).json({ erro: 'Não encontrada.' })
    res.json(lista)
  })
)

rotas.get(
  '/api/lot-code-list/:id/word',
  autenticar(),
  tratar(async (req, res) => {
    const lista = await obterListaCompleta(req.params.id)
    if (!lista) return res.status(404).json({ erro: 'Não encontrada.' })
    const arquivo = await gerarWord(lista)
    const nome = `Lot_Code_List_${String(lista.fatura).replace(/[^A-Za-z0-9_-]+/g, '_')}.docx`
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${nome}"`
    })
    res.send(arquivo)
  })
)

rotas.post(
  '/api/lot-code-list',
  autenticar(),
  tratar(async (req, res) => {
    const validado = validarLista(req.body)
    if (validado.erro) return res.status(400).json({ erro: validado.erro })
    const { lista, itens } = validado
    const id = await emTransacao(async (conexao) => {
      const [resultado] = await conexao.query(
        `INSERT INTO lot_code_list (fatura, importador_nome, importador_endereco, importador_att, data_documento,
          idioma, tipo_data, criado_por) VALUES (?,?,?,?,?,?,?,?)`,
        [
          lista.fatura,
          lista.importador_nome,
          lista.importador_endereco,
          lista.importador_att,
          lista.data_documento,
          lista.idioma,
          lista.tipo_data,
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
    await emTransacao(async (conexao) => {
      await conexao.query(
        `UPDATE lot_code_list SET fatura = ?, importador_nome = ?, importador_endereco = ?, importador_att = ?,
          data_documento = ?, idioma = ?, tipo_data = ? WHERE id = ?`,
        [
          lista.fatura,
          lista.importador_nome,
          lista.importador_endereco,
          lista.importador_att,
          lista.data_documento,
          lista.idioma,
          lista.tipo_data,
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

module.exports = rotas
