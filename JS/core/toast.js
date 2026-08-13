const DURACOES = { success: 3500, error: 6500, warning: 5000, info: 4000 }

const ICONES = {
  success: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  error:   `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  warning: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v5M6 9v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  info:    `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 5.5V9M6 3v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
}

function criarContainer() {
  let c = document.getElementById('toast-container')
  if (c) return c
  c = document.createElement('div')
  c.id = 'toast-container'
  document.body.appendChild(c)
  return c
}

function exibir(mensagem, tipo = 'info') {
  const container = criarContainer()

  const toast = document.createElement('div')
  toast.className = `toast-pietrobon toast-${tipo}`
  toast.setAttribute('role', 'alert')
  toast.innerHTML = `
    <div class="toast-icone">${ICONES[tipo]}</div>
    <div class="toast-msg">${String(mensagem)}</div>
    <button class="toast-fechar" aria-label="Fechar">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
    </button>
  `

  container.appendChild(toast)

  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('toast-visivel')))

  const remover = () => {
    toast.classList.remove('toast-visivel')
    setTimeout(() => toast.remove(), 380)
  }

  const timer = setTimeout(remover, DURACOES[tipo] || 4000)
  toast.querySelector('.toast-fechar').addEventListener('click', () => { clearTimeout(timer); remover() })
  toast.addEventListener('mouseenter', () => clearTimeout(timer))
}

function detectarTipo(texto) {
  if (/erro|error|falhou|falha|inválid|obrigatório|informe|selecione|sem (conexão|permissão)|token inválido|sessão expir/i.test(texto)) return 'error'
  if (/salvo!|sucesso|registrado!|enviado!|concluído|apagado|excluído|recebido|✓/i.test(texto)) return 'success'
  if (/atenção|aviso|certeza|risco/i.test(texto)) return 'warning'
  return 'info'
}

function iniciarBarraProgresso() {
  const barra = document.createElement('div')
  barra.id = 'barra-progresso'
  document.body.appendChild(barra)

  let progresso = 0
  let ativo = false
  let timer = null

  function avancar() {
    if (!ativo) return
    const salto = progresso < 50 ? 8 : progresso < 80 ? 3 : 1
    progresso = Math.min(progresso + salto, 92)
    barra.style.width = progresso + '%'
    barra.style.opacity = '1'
    timer = setTimeout(avancar, 180)
  }

  function concluir() {
    clearTimeout(timer)
    ativo = false
    progresso = 100
    barra.style.width = '100%'
    setTimeout(() => {
      barra.style.opacity = '0'
      setTimeout(() => { progresso = 0; barra.style.width = '0%' }, 400)
    }, 250)
  }

  barra.style.width = '15%'
  barra.style.opacity = '1'
  ativo = true
  setTimeout(avancar, 80)
  window.addEventListener('load', concluir, { once: true })
  setTimeout(concluir, 6000)
}

export function iniciarToast() {
  iniciarBarraProgresso()

  window.alert = (msg) => {
    if (msg === undefined || msg === null || msg === '') return
    exibir(String(msg), detectarTipo(String(msg)))
  }

  window.toast = {
    success: (msg) => exibir(msg, 'success'),
    error:   (msg) => exibir(msg, 'error'),
    warning: (msg) => exibir(msg, 'warning'),
    info:    (msg) => exibir(msg, 'info'),
  }
}