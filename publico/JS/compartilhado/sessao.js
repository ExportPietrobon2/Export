const USUARIOS_PERMITIDOS = [
  'joaoantonio@pietrobon.com.br',
  'export@pietrobon.com.br',
  'export2@pietrobon.com.br',
  'export3@pietrobon.com.br'
]

export const PAGINA_INICIAL = '/HTML/financeiro/painel.html'

function obterToken() {
  return sessionStorage.getItem('token')
}

export function obterPerfil() {
  const token = obterToken()
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (payload.exp * 1000 < Date.now() || !USUARIOS_PERMITIDOS.includes((payload.email || '').toLowerCase())) {
      sessionStorage.removeItem('token')
      return null
    }
    return payload
  } catch (_) {
    return null
  }
}

export function exigirPapel() {
  const perfil = obterPerfil()
  if (!perfil) {
    window.location.href = '/index.html'
    return null
  }
  return perfil
}

export function salvarToken(token) {
  localStorage.removeItem('token_deposito')
  sessionStorage.setItem('token', token)
}

export function sair() {
  sessionStorage.removeItem('token')
  localStorage.removeItem('token_deposito')
  window.location.href = '/index.html'
}
