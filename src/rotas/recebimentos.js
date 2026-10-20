const express = require('express')
const cloudinary = require('cloudinary').v2
const { TODOS_PERFIS, autenticar } = require('../middlewares/autenticacao')
const { banco } = require('../config/banco')
const { envioArquivo } = require('../servicos/envio-de-fotos')

const rotas = express.Router()

rotas.get('/api/recebimentos/pendentes', autenticar(TODOS_PERFIS), async (req, res) => {
  const [pedidos] = await banco.query(`
 SELECT DISTINCT p.id, p.numero_pi, p.cliente
 FROM pedidos p
 JOIN recebimentos_b2 r ON r.pi_id = p.id
 WHERE p.concluida = 0
 ORDER BY p.numero_pi ASC
 `)

  for (const pedido of pedidos) {
    const [produtos] = await banco.query('SELECT id, produto FROM produtos_pi WHERE pi_id = ? ORDER BY criado_em', [
      pedido.id
    ])
    for (const produto of produtos) {
      const [insumos] = await banco.query(
        'SELECT id, tipo, status_recebimento, quantidade_recebida, foto_url, foto_nota_url FROM recebimentos_b2 WHERE pi_id = ? AND produto_id = ?',
        [pedido.id, produto.id]
      )
      produto.insumos = insumos
    }
    pedido.produtos = produtos
  }

  res.json(pedidos)
})

rotas.patch(
  '/api/recebimentos/:id',
  autenticar(['admin', 'deposito']),
  envioArquivo.fields([
    { name: 'foto_produto', maxCount: 1 },
    { name: 'foto_nota', maxCount: 1 }
  ]),
  async (req, res) => {
    const { quantidade_recebida } = req.body
    let fotoProdutoUrl = null
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
      fotoProdutoUrl = await enviarFoto(req.files.foto_produto[0].buffer, 'recebimentos/produtos')
    }
    if (req.files?.foto_nota?.[0]) {
      fotoNotaUrl = await enviarFoto(req.files.foto_nota[0].buffer, 'recebimentos/notas')
    }

    await banco.query(
      'UPDATE recebimentos_b2 SET status_recebimento = ?, recebido_em = NOW(), quantidade_recebida = ?, foto_url = ?, foto_nota_url = ? WHERE id = ?',
      ['recebido', quantidade_recebida || null, fotoProdutoUrl, fotoNotaUrl, req.params.id]
    )

    res.json({ ok: true })
  }
)

rotas.patch('/api/recebimentos/:id/excluir-foto', autenticar(['admin']), async (req, res) => {
  const { campo } = req.body
  if (!['foto_url', 'foto_nota_url'].includes(campo)) {
    return res.status(400).json({ erro: 'Campo inválido' })
  }

  const [rows] = await banco.query(`SELECT ${campo} FROM recebimentos_b2 WHERE id = ?`, [req.params.id])
  if (rows.length && rows[0][campo]) {
    const urlFoto = rows[0][campo]
    const partes = urlFoto.split('/')
    const publicId = partes
      .slice(partes.indexOf('recebimentos'))
      .join('/')
      .replace(/\.[^/.]+$/, '')
    try {
      await cloudinary.uploader.destroy(publicId)
    } catch (e) {
      console.error('Erro ao apagar foto do Cloudinary:', e.message)
    }
  }

  const outrosCampos = campo === 'foto_url' ? 'foto_nota_url' : 'foto_url'
  const [rec] = await banco.query(`SELECT ${outrosCampos}, status_recebimento FROM recebimentos_b2 WHERE id = ?`, [
    req.params.id
  ])
  const outraFoto = rec[0]?.[outrosCampos]
  const novoStatus = outraFoto ? 'recebido' : 'pendente'

  await banco.query(`UPDATE recebimentos_b2 SET ${campo} = NULL, status_recebimento = ? WHERE id = ?`, [
    novoStatus,
    req.params.id
  ])
  res.json({ ok: true })
})

module.exports = rotas
