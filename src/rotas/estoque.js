const express = require('express')
const cloudinary = require('cloudinary').v2
const { TODOS_PERFIS, autenticar } = require('../middlewares/autenticacao')
const { envioArquivo } = require('../servicos/envio-de-fotos')
const { banco, emTransacao } = require('../config/banco')

const rotas = express.Router()

rotas.post(
  '/api/estoque/entrada',
  autenticar(['admin', 'deposito']),
  envioArquivo.fields([
    { name: 'foto_produto', maxCount: 1 },
    { name: 'foto_nota', maxCount: 1 }
  ]),
  async (req, res) => {
    const { embalagem_kg, rotulo_kg, pallet_caixas, produto, localizacao } = req.body
    let fotoUrl = null
    let fotoNotaUrl = null

    async function enviarFoto(buffer, pasta) {
      return new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream({ folder: pasta, resource_type: 'image' }, (erro, resultado) =>
            erro ? reject(erro) : resolve(resultado.secure_url)
          )
          .end(buffer)
      })
    }

    if (req.files?.foto_produto?.[0]) {
      fotoUrl = await enviarFoto(req.files.foto_produto[0].buffer, 'estoque/produtos')
    }
    if (req.files?.foto_nota?.[0]) {
      fotoNotaUrl = await enviarFoto(req.files.foto_nota[0].buffer, 'estoque/notas')
    }

    await banco.query(
      'INSERT INTO estoque_insumos (produto, embalagem_kg, rotulo_kg, pallet_caixas, foto_url, foto_nota_url, localizacao) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        produto || null,
        parseFloat(embalagem_kg) || 0,
        parseFloat(rotulo_kg) || 0,
        parseInt(pallet_caixas) || 0,
        fotoUrl,
        fotoNotaUrl,
        localizacao || null
      ]
    )

    res.json({ ok: true })
  }
)

rotas.get('/api/estoque/historico', autenticar(TODOS_PERFIS), async (req, res) => {
  const [rows] = await banco.query('SELECT * FROM estoque_insumos ORDER BY criado_em DESC LIMIT 50')
  res.json(rows)
})

rotas.get('/api/estoque/saldo', autenticar(TODOS_PERFIS), async (req, res) => {
  const [[entradas]] = await banco.query(
    'SELECT COALESCE(SUM(embalagem_kg),0) as emb, COALESCE(SUM(rotulo_kg),0) as rot, COALESCE(SUM(pallet_caixas),0) as pal FROM estoque_insumos'
  )
  const [[vinculos]] = await banco.query(
    'SELECT COALESCE(SUM(embalagem_kg),0) as emb, COALESCE(SUM(rotulo_kg),0) as rot, COALESCE(SUM(pallet_caixas),0) as pal FROM vinculos_insumos'
  )
  res.json({
    embalagem_kg: Math.max(0, parseFloat(entradas.emb) - parseFloat(vinculos.emb)),
    rotulo_kg: Math.max(0, parseFloat(entradas.rot) - parseFloat(vinculos.rot)),
    pallet_caixas: Math.max(0, parseInt(entradas.pal) - parseInt(vinculos.pal))
  })
})

rotas.get('/api/estoque/vinculos', autenticar(TODOS_PERFIS), async (req, res) => {
  const [rows] = await banco.query(`
 SELECT v.*, p.numero_pi, p.cliente
 FROM vinculos_insumos v
 JOIN pedidos p ON p.id = v.pi_id
 ORDER BY v.criado_em DESC LIMIT 100
 `)
  res.json(rows)
})

rotas.post('/api/estoque/vincular', autenticar(['admin', 'almoxarifado']), async (req, res) => {
  const { entrada_id, pi_id, produto, embalagem_kg, rotulo_kg, pallet_caixas } = req.body

  const falha = (mensagem) => ({ erro: mensagem })
  const resultado = await emTransacao(async (conexao) => {
    const [[entrada]] = await conexao.query(
      'SELECT embalagem_kg, rotulo_kg, pallet_caixas FROM estoque_insumos WHERE id = ? FOR UPDATE',
      [entrada_id]
    )
    if (!entrada) return falha('Entrada não encontrada.')

    const [[vinculados]] = await conexao.query(
      'SELECT COALESCE(SUM(embalagem_kg),0) as emb, COALESCE(SUM(rotulo_kg),0) as rot, COALESCE(SUM(pallet_caixas),0) as pal FROM vinculos_insumos WHERE entrada_id = ?',
      [entrada_id]
    )
    const saldoEmb = parseFloat(entrada.embalagem_kg) - parseFloat(vinculados.emb)
    const saldoRot = parseFloat(entrada.rotulo_kg) - parseFloat(vinculados.rot)
    const saldoPal = parseInt(entrada.pallet_caixas) - parseInt(vinculados.pal)

    if ((parseFloat(embalagem_kg) || 0) > saldoEmb)
      return falha(`Saldo insuficiente de embalagem. Disponível: ${saldoEmb} kg`)
    if ((parseFloat(rotulo_kg) || 0) > saldoRot)
      return falha(`Saldo insuficiente de rótulo. Disponível: ${saldoRot} kg`)
    if ((parseInt(pallet_caixas) || 0) > saldoPal)
      return falha(`Saldo insuficiente de pallets. Disponível: ${saldoPal}`)

    await conexao.query(
      'INSERT INTO vinculos_insumos (entrada_id, pi_id, produto, embalagem_kg, rotulo_kg, pallet_caixas) VALUES (?, ?, ?, ?, ?, ?)',
      [
        entrada_id,
        pi_id,
        produto || null,
        parseFloat(embalagem_kg) || 0,
        parseFloat(rotulo_kg) || 0,
        parseInt(pallet_caixas) || 0
      ]
    )
    return null
  })
  if (resultado) return res.status(400).json(resultado)
  res.json({ ok: true })
})

rotas.delete('/api/estoque/entradas/:id', autenticar(['admin', 'deposito']), async (req, res) => {
  await banco.query('DELETE FROM estoque_insumos WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

rotas.patch('/api/estoque/entradas/:id/produto', autenticar(['admin', 'almoxarifado']), async (req, res) => {
  const { produto } = req.body
  await banco.query('UPDATE estoque_insumos SET produto = ? WHERE id = ?', [produto || null, req.params.id])
  res.json({ ok: true })
})

rotas.patch(
  '/api/estoque/entradas/:id/localizacao',
  autenticar(['admin', 'almoxarifado', 'deposito']),
  async (req, res) => {
    const { localizacao } = req.body
    await banco.query('UPDATE estoque_insumos SET localizacao = ? WHERE id = ?', [localizacao || null, req.params.id])
    res.json({ ok: true })
  }
)

rotas.patch('/api/estoque/vinculos/:id', autenticar(['admin', 'almoxarifado']), async (req, res) => {
  const { pi_id, embalagem_kg, rotulo_kg, pallet_caixas } = req.body

  const [[entradas]] = await banco.query(
    'SELECT COALESCE(SUM(embalagem_kg),0) as emb, COALESCE(SUM(rotulo_kg),0) as rot, COALESCE(SUM(pallet_caixas),0) as pal FROM estoque_insumos'
  )
  const [[outros]] = await banco.query(
    'SELECT COALESCE(SUM(embalagem_kg),0) as emb, COALESCE(SUM(rotulo_kg),0) as rot, COALESCE(SUM(pallet_caixas),0) as pal FROM vinculos_insumos WHERE id != ?',
    [req.params.id]
  )
  const saldoEmb = parseFloat(entradas.emb) - parseFloat(outros.emb)
  const saldoRot = parseFloat(entradas.rot) - parseFloat(outros.rot)
  const saldoPal = parseInt(entradas.pal) - parseInt(outros.pal)

  if ((parseFloat(embalagem_kg) || 0) > saldoEmb)
    return res.status(400).json({ erro: `Saldo insuficiente de embalagem. Disponível: ${saldoEmb} kg` })
  if ((parseFloat(rotulo_kg) || 0) > saldoRot)
    return res.status(400).json({ erro: `Saldo insuficiente de rótulo. Disponível: ${saldoRot} kg` })
  if ((parseInt(pallet_caixas) || 0) > saldoPal)
    return res.status(400).json({ erro: `Saldo insuficiente de pallets. Disponível: ${saldoPal}` })

  const { produto } = req.body
  await banco.query(
    'UPDATE vinculos_insumos SET pi_id = ?, produto = ?, embalagem_kg = ?, rotulo_kg = ?, pallet_caixas = ? WHERE id = ?',
    [
      pi_id,
      produto || null,
      parseFloat(embalagem_kg) || 0,
      parseFloat(rotulo_kg) || 0,
      parseInt(pallet_caixas) || 0,
      req.params.id
    ]
  )
  res.json({ ok: true })
})

rotas.delete('/api/estoque/vinculos/:id', autenticar(['admin', 'almoxarifado']), async (req, res) => {
  await banco.query('DELETE FROM vinculos_insumos WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

module.exports = rotas
