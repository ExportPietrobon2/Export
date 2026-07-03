export function getPerfil() {
  const token = sessionStorage.getItem('token')
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (payload.exp * 1000 < Date.now()) {
      sessionStorage.removeItem('token')
      return null
    }
    return payload
  } catch {
    return null
  }
}

export function exigirPapel(papeisPermitidos) {
  const perfil = getPerfil()
  if (!perfil) {
    window.location.href = '/index.html'
    return null
  }
  if (!papeisPermitidos.includes(perfil.papel)) {
    window.location.href = '/index.html'
    return null
  }
  return perfil
}

export function sair() {
  sessionStorage.removeItem('token')
  window.location.href = '/index.html'
}