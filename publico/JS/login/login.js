import { api } from '/JS/compartilhado/api.js'
import { obterPerfil, salvarToken, PAGINA_INICIAL } from '/JS/compartilhado/sessao.js'

if (obterPerfil()) window.location.href = PAGINA_INICIAL

document.getElementById('form-login').addEventListener('submit', async (evento) => {
  evento.preventDefault()
  const email = document.getElementById('campo-email').value.trim()
  const senha = document.getElementById('campo-senha').value
  const msgErro = document.getElementById('mensagem-erro')
  msgErro.textContent = ''
  const resultado = await api.login(email, senha)
  if (resultado.erro) {
    msgErro.textContent = resultado.erro
    return
  }
  salvarToken(resultado.token)
  window.location.href = PAGINA_INICIAL
})
