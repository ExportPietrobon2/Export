const jwt = require('jsonwebtoken')

const CHAVE_JWT = process.env.JWT_SECRET || 'segredo-trocar-em-producao'

function autenticar(papeis) {
  return (req, res, next) => {
    const cabecalho = req.headers.authorization
    if (!cabecalho) return res.status(401).json({ erro: 'Não autenticado' })
    const token = cabecalho.replace('Bearer ', '')
    try {
      const dadosToken = jwt.verify(token, CHAVE_JWT)
      if (papeis && !papeis.includes(dadosToken.papel)) {
        return res.status(403).json({ erro: 'Sem permissão' })
      }
      req.usuario = dadosToken
      next()
    } catch {
      return res.status(401).json({ erro: 'Token inválido' })
    }
  }
}

const TODOS_PERFIS = [
  'admin',
  'almoxarifado',
  'deposito',
  'convidado',
  'gerente_producao',
  'compras',
  'compras_aromas',
  'auxiliar'
]

const EMAILS_FINANCEIRO = ['export2@pietrobon.com.br', 'export@pietrobon.com.br', 'joaoantonio@pietrobon.com.br']

function autenticarContabil() {
  const base = autenticar(['admin'])
  return (req, res, next) =>
    base(req, res, () => {
      if (!EMAILS_FINANCEIRO.includes((req.usuario.email || '').toLowerCase())) {
        return res.status(403).json({ erro: 'Sem permissão' })
      }
      next()
    })
}

const EMAILS_CHECKLIST = ['export2@pietrobon.com.br', 'export@pietrobon.com.br', 'export3@pietrobon.com.br']

function autenticarChecklist() {
  const base = autenticar(TODOS_PERFIS)
  return (req, res, next) =>
    base(req, res, () => {
      if (!EMAILS_CHECKLIST.includes((req.usuario.email || '').toLowerCase())) {
        return res.status(403).json({ erro: 'Sem permissão' })
      }
      next()
    })
}

const EMAILS_TAREFAS = [
  'export@pietrobon.com.br',
  'export2@pietrobon.com.br',
  'joaoantonio@pietrobon.com.br',
  'export3@pietrobon.com.br'
]

function autenticarTarefas() {
  return (req, res, next) => {
    const token = (req.headers.authorization || '').split(' ')[1]
    if (!token) return res.status(401).json({ erro: 'Não autenticado.' })
    try {
      const dadosToken = jwt.verify(token, CHAVE_JWT)
      if (!EMAILS_TAREFAS.includes((dadosToken.email || '').toLowerCase())) {
        return res.status(403).json({ erro: 'Acesso restrito a Tarefas Exportação.' })
      }
      req.usuario = dadosToken
      next()
    } catch {
      return res.status(401).json({ erro: 'Token inválido.' })
    }
  }
}

module.exports = { CHAVE_JWT, TODOS_PERFIS, autenticar, autenticarChecklist, autenticarContabil, autenticarTarefas }
