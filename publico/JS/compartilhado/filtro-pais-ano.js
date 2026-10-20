const SEM_PAIS = 'Sem país'
const SEM_ANO = 'Sem data'

export function anoDe(data) {
  if (!data) return SEM_ANO
  const s = String(data).slice(0, 10)
  const ano = Number(s.slice(0, 4))
  return ano ? String(ano) : SEM_ANO
}

export function paisDe(valor) {
  const t = String(valor || '').trim()
  return t ? t.toUpperCase() : SEM_PAIS
}

function lerEstado(chave) {
  try {
    return JSON.parse(localStorage.getItem('hub-filtro:' + chave) || '{}')
  } catch (_) {
    return {}
  }
}

function gravarEstado(chave, estado) {
  try {
    localStorage.setItem('hub-filtro:' + chave, JSON.stringify(estado))
  } catch (_) {}
}

function ordenarPaises(a, b) {
  if (a === SEM_PAIS) return 1
  if (b === SEM_PAIS) return -1
  return a.localeCompare(b, 'pt-BR')
}

function ordenarAnos(a, b) {
  if (a === SEM_ANO) return 1
  if (b === SEM_ANO) return -1
  return Number(b) - Number(a)
}

function contar(itens, campo) {
  const mapa = {}
  itens.forEach((el) => {
    const v = el.dataset[campo]
    mapa[v] = (mapa[v] || 0) + 1
  })
  return mapa
}

const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function chip(valor, rotulo, qtd, ativo, tipo) {
  valor = esc(valor)
  rotulo = esc(rotulo)
  return `<button type="button" class="filtro-chip${ativo ? ' ativo' : ''}" data-tipo="${tipo}" data-valor="${valor}">
    <span>${rotulo}</span><span class="filtro-chip-qtd">${qtd}</span></button>`
}

export function filtroPaisAno(lista, { chave, antesDe, comAno = true, aoMudar } = {}) {
  if (!lista) return
  antesDe = antesDe || lista
  const anterior =
    antesDe.parentElement && antesDe.parentElement.querySelector(`:scope > .filtro-pais-ano[data-chave="${chave}"]`)
  if (anterior) anterior.remove()

  const itens = [...lista.querySelectorAll('[data-pais]')]
  if (!itens.length) return

  const estado = lerEstado(chave)
  const barra = document.createElement('div')
  barra.className = 'filtro-pais-ano no-print'
  barra.dataset.chave = chave
  antesDe.before(barra)

  const desenhar = () => {
    const paises = contar(itens, 'pais')
    if (estado.pais && !paises[estado.pais]) estado.pais = ''
    const doPais = estado.pais ? itens.filter((el) => el.dataset.pais === estado.pais) : itens
    const anos = comAno ? contar(doPais, 'ano') : {}
    if (estado.ano && !anos[estado.ano]) estado.ano = ''

    const linhaPaises = [chip('', 'Todos', itens.length, !estado.pais, 'pais')]
      .concat(
        Object.keys(paises)
          .sort(ordenarPaises)
          .map((p) => chip(p, p, paises[p], estado.pais === p, 'pais'))
      )
      .join('')
    const linhaAnos =
      comAno && Object.keys(anos).length > 0
        ? [chip('', 'Todos os anos', doPais.length, !estado.ano, 'ano')]
            .concat(
              Object.keys(anos)
                .sort(ordenarAnos)
                .map((a) => chip(a, a, anos[a], estado.ano === a, 'ano'))
            )
            .join('')
        : ''

    barra.innerHTML = `
      <div class="filtro-linha"><span class="filtro-rotulo">País</span><div class="filtro-chips">${linhaPaises}</div></div>
      ${linhaAnos ? `<div class="filtro-linha"><span class="filtro-rotulo">Ano</span><div class="filtro-chips">${linhaAnos}</div></div>` : ''}`

    let visiveis = 0
    itens.forEach((el) => {
      const ok = (!estado.pais || el.dataset.pais === estado.pais) && (!estado.ano || el.dataset.ano === estado.ano)
      el.style.display = ok ? '' : 'none'
      if (ok) visiveis++
    })
    if (aoMudar) aoMudar(visiveis)
    document.dispatchEvent(new CustomEvent('hub:filtro'))
  }

  barra.addEventListener('click', (e) => {
    const b = e.target.closest('.filtro-chip')
    if (!b) return
    if (b.dataset.tipo === 'pais') {
      estado.pais = b.dataset.valor
      estado.ano = ''
    } else estado.ano = b.dataset.valor
    gravarEstado(chave, estado)
    desenhar()
  })

  desenhar()
}
