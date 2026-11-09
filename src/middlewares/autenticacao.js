const jwt = require('jsonwebtoken')

const CHAVE_JWT = process.env.JWT_SECRET || 'segredo-trocar-em-producao'

const USUARIOS_PERMITIDOS = [
  'joaoantonio@pietrobon.com.br',
  'export@pietrobon.com.br',
  'export2@pietrobon.com.br',
  'export3@pietrobon.com.br'
]

function emailPermitido(email) {
  return USUARIOS_PERMITIDOS.includes(
    String(email || '')
      .trim()
      .toLowerCase()
  )
}

function autenticar() {
  return (req, res, next) => {
    const token = (req.headers.authorization || '').replace('Bearer ', '')
    if (!token) return res.status(401).json({ erro: 'Não autenticado.' })
    try {
      const dadosToken = jwt.verify(token, CHAVE_JWT)
      if (!emailPermitido(dadosToken.email)) return res.status(403).json({ erro: 'Sem permissão.' })
      req.usuario = dadosToken
      next()
    } catch {
      return res.status(401).json({ erro: 'Token inválido.' })
    }
  }
}

module.exports = { CHAVE_JWT, USUARIOS_PERMITIDOS, emailPermitido, autenticar }
