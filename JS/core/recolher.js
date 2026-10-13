const SELETOR_TITULO = '.secao-titulo-card, h5.fw-bold'
const CHAVE = 'hub-secoes:' + (document.body.dataset.pagina || location.pathname)

let estado = {}
try { estado = JSON.parse(localStorage.getItem(CHAVE) || '{}') } catch (_) { estado = {} }

function salvarEstado() {
  try { localStorage.setItem(CHAVE, JSON.stringify(estado)) } catch (_) {}
}

function ehTitulo(el) {
  return el && el.nodeType === 1 && el.matches(SELETOR_TITULO)
}

function linhaComTitulo(el) {
  if (!el || el.nodeType !== 1) return null
  if (!el.classList.contains('d-flex')) return null
  const primeiro = el.firstElementChild
  return ehTitulo(primeiro) ? primeiro : null
}

function inicioDeSecao(el) {
  return ehTitulo(el) || linhaComTitulo(el) !== null
}

function ignorar(titulo) {
  if (titulo.dataset.recolhivel) return true
  if (titulo.tagName === 'SUMMARY') return true
  if (titulo.closest('.modal, .dropdown-menu, summary, details, .no-recolher, table, .page-header, .toast-pietrobon')) return true
  return false
}

function textoChave(titulo) {
  return (titulo.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60)
}

function contarItens(corpo) {
  const visivel = (el) => el.style.display !== 'none'
  const linhas = [...corpo.querySelectorAll('tbody tr')].filter(visivel).length
  if (linhas) return `${linhas} ${linhas === 1 ? 'linha' : 'linhas'}`
  const cards = [...corpo.querySelectorAll(':scope > div > .card, :scope > .card, .lista-pi-item, .card-recebimento, .pi-linha')].filter(visivel).length
  if (cards) return `${cards} ${cards === 1 ? 'item' : 'itens'}`
  return ''
}

function temCampos(corpo) {
  return !!corpo.querySelector(
    'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=search]), select, textarea'
  )
}

function atualizarResumo(titulo, corpo) {
  const alvo = titulo.querySelector('.recolher-resumo')
  if (!alvo) return
  const resumo = contarItens(corpo)
  alvo.textContent = resumo
  alvo.style.display = resumo ? '' : 'none'
}

function aplicar(titulo, corpo, aberto) {
  titulo.setAttribute('aria-expanded', aberto ? 'true' : 'false')
  titulo.classList.toggle('recolher-aberto', aberto)
  corpo.classList.toggle('recolher-fechado', !aberto)
  atualizarResumo(titulo, corpo)
}

function montar(titulo) {
  if (ignorar(titulo)) return
  const linha = titulo.parentElement && titulo.parentElement.classList.contains('d-flex') &&
    titulo.parentElement.firstElementChild === titulo ? titulo.parentElement : null
  const cabeca = linha || titulo
  const conteudo = []
  let irmao = cabeca.nextElementSibling
  while (irmao && !inicioDeSecao(irmao) && !irmao.classList.contains('recolher-corpo')) {
    if (irmao.tagName === 'SCRIPT' || irmao.classList.contains('modal')) break
    conteudo.push(irmao)
    irmao = irmao.nextElementSibling
  }
  if (!conteudo.length) return

  const corpo = document.createElement('div')
  corpo.className = 'recolher-corpo'
  cabeca.after(corpo)
  conteudo.forEach((n) => corpo.appendChild(n))

  const chave = textoChave(titulo)
  titulo.dataset.recolhivel = '1'
  titulo.dataset.recolherChave = chave
  titulo.classList.add('recolher-titulo')
  titulo.setAttribute('role', 'button')
  titulo.setAttribute('tabindex', '0')
  if (linha) linha.classList.add('recolher-linha')

  const resumo = document.createElement('span')
  resumo.className = 'recolher-resumo'
  const seta = document.createElement('span')
  seta.className = 'recolher-seta'
  seta.setAttribute('aria-hidden', 'true')
  seta.textContent = '▸'
  titulo.prepend(seta)
  titulo.appendChild(resumo)

  const aberto = chave in estado ? estado[chave] : temCampos(corpo)
  aplicar(titulo, corpo, aberto)

  const alternar = () => {
    const novo = titulo.getAttribute('aria-expanded') !== 'true'
    estado[chave] = novo
    salvarEstado()
    aplicar(titulo, corpo, novo)
  }
  titulo.addEventListener('click', (e) => { e.preventDefault(); alternar() })
  titulo.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternar() }
  })
}

function recolocarSoltos() {
  document.querySelectorAll('.recolher-corpo').forEach((corpo) => {
    let irmao = corpo.nextElementSibling
    while (irmao && !inicioDeSecao(irmao) && !irmao.classList.contains('recolher-corpo') &&
           irmao.tagName !== 'SCRIPT' && !irmao.classList.contains('modal')) {
      const proximo = irmao.nextElementSibling
      corpo.appendChild(irmao)
      irmao = proximo
    }
    const cabeca = corpo.previousElementSibling
    const titulo = cabeca && (ehTitulo(cabeca) ? cabeca : cabeca.querySelector('.recolher-titulo'))
    if (titulo) atualizarResumo(titulo, corpo)
  })
}

function montarBarraGeral() {
  const header = document.querySelector('.page-header')
  if (!header || header.querySelector('.recolher-barra')) return
  const total = document.querySelectorAll('.recolher-titulo').length
  if (total < 2) return
  const barra = document.createElement('div')
  barra.className = 'recolher-barra no-print'
  barra.innerHTML = `
    <button type="button" class="recolher-acao" data-acao="abrir">Expandir tudo</button>
    <button type="button" class="recolher-acao" data-acao="fechar">Recolher tudo</button>`
  barra.addEventListener('click', (e) => {
    const btn = e.target.closest('.recolher-acao')
    if (!btn) return
    const abrir = btn.dataset.acao === 'abrir'
    document.querySelectorAll('.recolher-titulo').forEach((t) => {
      const cabeca = t.closest('.recolher-linha') || t
      const corpo = cabeca.nextElementSibling
      if (!corpo || !corpo.classList.contains('recolher-corpo')) return
      estado[t.dataset.recolherChave] = abrir
      aplicar(t, corpo, abrir)
    })
    salvarEstado()
  })
  header.appendChild(barra)
}

let agendado = false
function processar() {
  agendado = false
  observador.disconnect()
  document.querySelectorAll(SELETOR_TITULO).forEach(montar)
  recolocarSoltos()
  montarBarraGeral()
  observador.observe(document.body, { childList: true, subtree: true })
}

const observador = new MutationObserver(() => {
  if (agendado) return
  agendado = true
  requestAnimationFrame(processar)
})

document.addEventListener('hub:filtro', recolocarSoltos)

export function iniciarRecolhiveis() {
  processar()
}
