const express = require('express')
const bcrypt = require('bcryptjs')
const { banco } = require('../config/banco')
const { autenticarTarefas } = require('../middlewares/autenticacao')

const rotas = express.Router()

async function inicializarTarefas() {
  try {
    await banco.query(`CREATE TABLE IF NOT EXISTS tarefas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      titulo VARCHAR(255) NOT NULL,
      descricao TEXT,
      coluna ENUM('a_fazer','em_progresso','concluido') DEFAULT 'a_fazer',
      prioridade ENUM('baixa','normal','alta','urgente') DEFAULT 'normal',
      responsavel VARCHAR(100),
      criado_por VARCHAR(100),
      prazo DATE,
      ordem INT DEFAULT 0,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`)
    const hash = await bcrypt.hash('exp123', 10)
    await banco.query('INSERT IGNORE INTO usuarios (email, senha, nome, papel) VALUES (?, ?, ?, ?)', [
      'export3@pietrobon.com.br',
      hash,
      'Bernardo',
      'auxiliar'
    ])
  } catch (e) {
    console.error('Erro ao inicializar Tarefas:', e.message)
  }
}

setTimeout(inicializarTarefas, 3000)

rotas.get('/api/tarefas', autenticarTarefas(), async (req, res) => {
  try {
    const [rows] = await banco.query('SELECT * FROM tarefas ORDER BY coluna, ordem, criado_em DESC')
    res.json(rows)
  } catch (e) {
    res.status(500).json({ erro: e.message })
  }
})

rotas.post('/api/tarefas', autenticarTarefas(), async (req, res) => {
  try {
    const { titulo, descricao, coluna, prioridade, responsavel, prazo } = req.body
    if (!titulo) return res.status(400).json({ erro: 'Título obrigatório.' })
    const [r] = await banco.query(
      'INSERT INTO tarefas (titulo, descricao, coluna, prioridade, responsavel, prazo, criado_por) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        titulo,
        descricao || null,
        coluna || 'a_fazer',
        prioridade || 'normal',
        responsavel || null,
        prazo || null,
        req.usuario.email
      ]
    )
    const [[nova]] = await banco.query('SELECT * FROM tarefas WHERE id = ?', [r.insertId])
    res.json(nova)
  } catch (e) {
    res.status(500).json({ erro: e.message })
  }
})

rotas.patch('/api/tarefas/:id', autenticarTarefas(), async (req, res) => {
  try {
    const { titulo, descricao, coluna, prioridade, responsavel, prazo, ordem } = req.body
    const campos = []
    const vals = []
    if (titulo !== undefined) {
      campos.push('titulo = ?')
      vals.push(titulo)
    }
    if (descricao !== undefined) {
      campos.push('descricao = ?')
      vals.push(descricao)
    }
    if (coluna !== undefined) {
      campos.push('coluna = ?')
      vals.push(coluna)
    }
    if (prioridade !== undefined) {
      campos.push('prioridade = ?')
      vals.push(prioridade)
    }
    if (responsavel !== undefined) {
      campos.push('responsavel = ?')
      vals.push(responsavel)
    }
    if (prazo !== undefined) {
      campos.push('prazo = ?')
      vals.push(prazo || null)
    }
    if (ordem !== undefined) {
      campos.push('ordem = ?')
      vals.push(ordem)
    }
    if (!campos.length) return res.status(400).json({ erro: 'Nada para atualizar.' })
    vals.push(req.params.id)
    await banco.query(`UPDATE tarefas SET ${campos.join(', ')} WHERE id = ?`, vals)
    const [[atualizada]] = await banco.query('SELECT * FROM tarefas WHERE id = ?', [req.params.id])
    res.json(atualizada)
  } catch (e) {
    res.status(500).json({ erro: e.message })
  }
})

rotas.delete('/api/tarefas/:id', autenticarTarefas(), async (req, res) => {
  try {
    await banco.query('DELETE FROM tarefas WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ erro: e.message })
  }
})

module.exports = rotas
