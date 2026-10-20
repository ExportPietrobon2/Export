const express = require('express')
const { banco } = require('../config/banco')
const { TODOS_PERFIS, autenticar } = require('../middlewares/autenticacao')

const rotas = express.Router()

async function inicializarCatalogoProdutos() {
  try {
    await banco.query(`CREATE TABLE IF NOT EXISTS produtos_catalogo (
      id   INT AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(500) NOT NULL,
      UNIQUE KEY unique_nome (nome(250)),
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`)
  } catch (e) {
    console.error('Erro ao criar tabela catálogo:', e.message)
  }
  try {
    const [[{ total }]] = await banco.query('SELECT COUNT(*) as total FROM produtos_catalogo')
    if (Number(total) === 0) {
      const [r] = await banco.query(
        `INSERT IGNORE INTO produtos_catalogo (nome)
         SELECT DISTINCT produto FROM produtos_pi
         WHERE produto IS NOT NULL AND produto != ''`
      )
      if (r.affectedRows > 0) console.log(`Catálogo: ${r.affectedRows} produto(s) importado(s) de produtos_pi.`)
    }
  } catch (e) {
    console.error('Erro ao popular catálogo:', e.message)
  }
}

setTimeout(inicializarCatalogoProdutos, 4000)

rotas.get('/api/catalogo-produtos', autenticar(TODOS_PERFIS), async (req, res) => {
  try {
    const [rows] = await banco.query('SELECT id, nome FROM produtos_catalogo ORDER BY nome ASC')
    res.json(rows)
  } catch (e) {
    res.status(500).json({ erro: e.message })
  }
})

rotas.post('/api/catalogo-produtos', autenticar(TODOS_PERFIS), async (req, res) => {
  try {
    const { nome } = req.body
    if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Nome obrigatório.' })
    await banco.query('INSERT IGNORE INTO produtos_catalogo (nome) VALUES (?)', [nome.trim()])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ erro: e.message })
  }
})

rotas.delete('/api/catalogo-produtos/:id', autenticar(['admin']), async (req, res) => {
  try {
    await banco.query('DELETE FROM produtos_catalogo WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ erro: e.message })
  }
})

module.exports = rotas
