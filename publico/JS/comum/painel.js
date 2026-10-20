let painel = null
let instancia = null
let idAtual = null

function garantir() {
  if (painel) return painel
  painel = document.createElement('div')
  painel.className = 'offcanvas offcanvas-end painel-detalhe'
  painel.tabIndex = -1
  painel.id = 'painel-detalhe'
  painel.innerHTML = `
    <div class="offcanvas-header painel-topo">
      <div class="painel-titulos">
        <div class="painel-titulo"></div>
        <div class="painel-subtitulo"></div>
        <div class="painel-selos"></div>
      </div>
      <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Fechar"></button>
    </div>
    <div class="offcanvas-body painel-corpo"></div>
    <div class="painel-rodape"></div>`
  document.body.appendChild(painel)
  instancia = window.bootstrap ? new window.bootstrap.Offcanvas(painel) : null
  painel.addEventListener('hidden.bs.offcanvas', () => {
    idAtual = null
  })
  return painel
}

export function corpoPainel() {
  return garantir()
}

export function painelAbertoId() {
  return idAtual
}

export function abrirPainel({ id, titulo, subtitulo = '', selos = '', conteudo, rodape = '' }) {
  const el = garantir()
  idAtual = id == null ? null : String(id)
  el.querySelector('.painel-titulo').textContent = titulo || ''
  el.querySelector('.painel-subtitulo').innerHTML = subtitulo
  el.querySelector('.painel-selos').innerHTML = selos
  const corpo = el.querySelector('.painel-corpo')
  corpo.innerHTML = ''
  if (typeof conteudo === 'string') corpo.innerHTML = conteudo
  else if (conteudo) corpo.appendChild(conteudo)
  const rod = el.querySelector('.painel-rodape')
  rod.innerHTML = rodape
  rod.style.display = rodape ? '' : 'none'
  if (instancia && !el.classList.contains('show')) instancia.show()
  else if (!instancia) el.classList.add('show')
}

export function fecharPainel() {
  if (instancia) instancia.hide()
  else if (painel) painel.classList.remove('show')
  idAtual = null
}
