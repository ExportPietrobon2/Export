import { api } from '/JS/core/api.js'
import { TIPOS_INSUMO, formatarQuantidade } from '/JS/core/constants.js'
import { exigirPapel } from '/JS/core/auth.js'
import { montarCabecalho } from '/JS/core/cabecalho.js'

const listaPedidos  = document.getElementById('lista-pedidos')
const paisesAbertos = new Set()
const anosAbertos   = new Set()
const pisAbertos    = new Set()
let primeiraVez     = true
let todosOsPedidos  = []
let catalogo        = []
let piIdAtual       = null
let produtoSelecionado = null
let modalSeletor    = null

// ── Agrupamento ─────────────────────────────────────────────────
function extrarAno(d) {
  if (!d) return 'Sem data'
  return String(new Date(String(d).slice(0, 10) + 'T00:00:00').getFullYear())
}
function agruparPorPaisEAno(pedidos) {
  const g = {}
  for (const p of pedidos) {
    const pais = (p.destino || '').trim() || 'Sem destino'
    const ano  = extrarAno(p.data_cadastro)
    if (!g[pais]) g[pais] = {}
    if (!g[pais][ano]) g[pais][ano] = []
    g[pais][ano].push(p)
  }
  return g
}
function inicGrupos(grupos) { if (!primeiraVez) return; primeiraVez = false }

window.toggleGrupoPais = function(pais) {
  if (paisesAbertos.has(pais)) paisesAbertos.delete(pais); else paisesAbertos.add(pais)
  renderizarLista(todosOsPedidos).catch(console.error)
}
window.toggleGrupoAno = function(chave) {
  if (anosAbertos.has(chave)) anosAbertos.delete(chave); else anosAbertos.add(chave)
  renderizarLista(todosOsPedidos).catch(console.error)
}
window.togglePi = function(piId) {
  const body    = document.getElementById(`pi-body-${piId}`)
  const chevron = document.getElementById(`pi-chevron-${piId}`)
  if (!body) return
  const aberto = body.style.display !== 'none'
  body.style.display = aberto ? 'none' : 'block'
  if (chevron) chevron.textContent = aberto ? '▶' : '▼'
  if (aberto) pisAbertos.delete(String(piId)); else pisAbertos.add(String(piId))
}

// ── Catálogo ─────────────────────────────────────────────────────
async function carregarCatalogo() {
  const dados = await api.catalogoProdutos.listar()
  if (Array.isArray(dados)) { catalogo = dados; renderizarCatalogo() }
}
function renderizarCatalogo() {
  const lista = document.getElementById('lista-catalogo')
  const total = document.getElementById('catalogo-total')
  if (total) total.textContent = `${catalogo.length} produto${catalogo.length !== 1 ? 's' : ''}`
  if (!lista) return
  if (!catalogo.length) {
    lista.innerHTML = '<p class="text-muted fst-italic small">Nenhum produto salvo ainda. Eles são adicionados automaticamente ao cadastrar.</p>'
    return
  }
  lista.innerHTML = catalogo.map(p => `
    <div class="catalogo-item d-flex align-items-center justify-content-between gap-2 py-1 border-bottom" id="cat-item-${p.id}">
      <span class="small">${p.nome}</span>
      <button class="btn btn-sm btn-outline-danger py-0 px-2" style="border-radius:6px;font-size:.72rem"
        onclick="excluirDoCatalogo(${p.id})">✕</button>
    </div>`).join('')
}
window.excluirDoCatalogo = async function(id) {
  const r = await api.catalogoProdutos.excluir(id)
  if (r?.erro) { alert('Erro ao excluir.'); return }
  catalogo = catalogo.filter(p => p.id !== id)
  renderizarCatalogo()
}

// ── Modal seletor de produto ──────────────────────────────────────
function renderizarListaSeletor(busca) {
  const lista = document.getElementById('seletor-lista')
  const q     = (busca || '').toLowerCase().trim()
  const filtrados = q ? catalogo.filter(p => p.nome.toLowerCase().includes(q)) : catalogo

  if (!filtrados.length && !q) {
    lista.innerHTML = '<div class="seletor-vazio">Catálogo vazio. Cadastre o primeiro produto normalmente — ele será salvo automaticamente.</div>'
    return
  }

  let html = filtrados.map(p => {
    const esc = p.nome.replace(/'/g, "\\'").replace(/"/g, '&quot;')
    const ativo = produtoSelecionado === p.nome
    return `<div class="seletor-item${ativo ? ' seletor-ativo' : ''}" onclick="selecionarProdutoCatalogo('${esc}')">${p.nome}</div>`
  }).join('')

  if (q && !filtrados.some(p => p.nome.toLowerCase() === q)) {
    const esc = busca.replace(/'/g, "\\'")
    html += `<div class="seletor-item seletor-novo" onclick="selecionarProdutoCatalogo('${esc}')">
      ➕ Usar "<strong>${busca}</strong>" como novo produto
    </div>`
  }

  if (!html) html = '<div class="seletor-vazio">Nenhum resultado para esta busca.</div>'
  lista.innerHTML = html
}

window.selecionarProdutoCatalogo = function(nome) {
  produtoSelecionado = nome
  document.getElementById('seletor-nome-display').textContent = nome
  document.getElementById('seletor-selecionado').style.display = 'block'
  document.getElementById('seletor-hint').style.display = 'none'
  renderizarListaSeletor(document.getElementById('seletor-busca').value)
  setTimeout(() => document.getElementById('seletor-qtd')?.focus(), 50)
}

window.abrirSeletorProduto = function(piId) {
  piIdAtual = piId
  produtoSelecionado = null
  const pedido = todosOsPedidos.find(p => p.id === piId)
  const label  = document.getElementById('seletor-pi-label')
  if (label && pedido) label.textContent = `PI ${pedido.numero_pi}${pedido.cliente ? ' — ' + pedido.cliente : ''}`
  document.getElementById('seletor-busca').value = ''
  document.getElementById('seletor-qtd').value   = ''
  document.getElementById('seletor-selecionado').style.display = 'none'
  document.getElementById('seletor-hint').style.display = 'block'
  renderizarListaSeletor('')
  if (!modalSeletor) modalSeletor = new bootstrap.Modal(document.getElementById('modal-seletor-produto'))
  modalSeletor.show()
  setTimeout(() => document.getElementById('seletor-busca')?.focus(), 350)
}

document.getElementById('seletor-busca').addEventListener('input', e => {
  renderizarListaSeletor(e.target.value)
})

document.getElementById('seletor-qtd').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-confirmar-produto')?.click()
})

document.getElementById('btn-confirmar-produto').addEventListener('click', async () => {
  if (!produtoSelecionado) { alert('Selecione um produto.'); return }
  const qtd = document.getElementById('seletor-qtd').value
  if (!qtd || Number(qtd) <= 0) { document.getElementById('seletor-qtd').focus(); return }

  const btn = document.getElementById('btn-confirmar-produto')
  btn.disabled = true; btn.textContent = '...'

  const resultado = await api.produtos.criar({ pi_id: piIdAtual, produto: produtoSelecionado, quantidade: qtd })

  btn.disabled = false; btn.textContent = '✔ Adicionar'

  if (resultado?.erro) { alert('Erro ao cadastrar produto.'); return }

  // Salva no catálogo se novo
  if (!catalogo.some(p => p.nome.toLowerCase() === produtoSelecionado.toLowerCase())) {
    await api.catalogoProdutos.adicionar(produtoSelecionado)
    const novaLista = await api.catalogoProdutos.listar()
    if (Array.isArray(novaLista)) { catalogo = novaLista; renderizarCatalogo() }
  }

  modalSeletor?.hide()
  window.toast?.success('Produto adicionado!')
  renderizarLista(todosOsPedidos).catch(console.error)
})

// ── Card de PI colapsável ─────────────────────────────────────────
function criarCardPi(pedido, produtos) {
  const aberto = pisAbertos.has(String(pedido.id))
  const bloco  = document.createElement('div')
  bloco.className = 'card border-0 shadow-sm mb-2'
  bloco.id = `pi-card-${pedido.id}`

  const dataCadFmt = pedido.data_cadastro
    ? ' · ' + new Date(String(pedido.data_cadastro).slice(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR') : ''
  const qtdProd = produtos?.length || 0

  const cabecalho = document.createElement('div')
  cabecalho.className = 'card-body d-flex justify-content-between align-items-center flex-wrap gap-2 py-2'
  cabecalho.style.cursor = 'pointer'
  cabecalho.onclick = () => window.togglePi(pedido.id)
  cabecalho.innerHTML = `
    <div class="d-flex align-items-center gap-2 flex-wrap">
      <span id="pi-chevron-${pedido.id}" style="font-size:.65rem;color:#94a3b8;width:12px">${aberto ? '▼' : '▶'}</span>
      <strong class="text-danger">PI ${pedido.numero_pi}</strong>
      <span class="text-muted small">${pedido.cliente ? '— ' + pedido.cliente : ''}${dataCadFmt}</span>
      <span class="badge bg-light text-dark border" style="font-size:.72rem">${qtdProd} produto${qtdProd !== 1 ? 's' : ''}</span>
    </div>`

  if (!window._convidado) {
    const btnExcluir = document.createElement('button')
    btnExcluir.type = 'button'
    btnExcluir.className = 'btn btn-sm btn-outline-danger'
    btnExcluir.style.borderRadius = '8px'
    btnExcluir.textContent = 'Excluir PI'
    btnExcluir.addEventListener('click', e => { e.stopPropagation(); excluirPi(pedido.id, pedido.numero_pi) })
    cabecalho.appendChild(btnExcluir)
  }
  bloco.appendChild(cabecalho)

  const corpo = document.createElement('div')
  corpo.id = `pi-body-${pedido.id}`
  corpo.style.display = aberto ? 'block' : 'none'

  const lista = document.createElement('ul')
  lista.className = 'list-group list-group-flush'

  if (!produtos || !produtos.length) {
    const vazio = document.createElement('li')
    vazio.className = 'list-group-item text-muted fst-italic small py-2'
    vazio.textContent = 'Nenhum produto cadastrado ainda.'
    lista.appendChild(vazio)
  } else {
    produtos.forEach(produto => {
      const item = document.createElement('li')
      item.className = 'list-group-item d-flex align-items-center justify-content-between gap-2 py-2'
      item.innerHTML = `
        <span class="small fw-semibold">${produto.produto}</span>
        <div class="d-flex align-items-center gap-2">
          <span class="badge bg-light text-dark border" id="qtd-label-${produto.id}">${formatarQuantidade(produto.quantidade)}</span>
          ${!window._convidado
            ? `<button class="btn btn-sm btn-outline-warning btn-editar-qtd"
                data-produto-id="${produto.id}" data-quantidade="${produto.quantidade}"
                style="border-radius:8px;font-size:.78rem">Editar qtd</button>` : ''}
        </div>`
      lista.appendChild(item)
    })
  }
  corpo.appendChild(lista)

  if (!window._convidado) {
    const footer = document.createElement('div')
    footer.className = 'px-3 pb-3 pt-1'
    const btnAdd = document.createElement('button')
    btnAdd.className = 'btn-add-produto-inline'
    btnAdd.textContent = '➕ Adicionar produto'
    btnAdd.onclick = () => window.abrirSeletorProduto(pedido.id)
    footer.appendChild(btnAdd)
    corpo.appendChild(footer)
  }

  bloco.appendChild(corpo)
  return bloco
}

// ── Renderização agrupada ────────────────────────────────────────
async function renderizarLista(pedidos) {
  listaPedidos.innerHTML = ''
  if (!pedidos.length) {
    listaPedidos.innerHTML = '<p class="text-muted fst-italic">Nenhuma PI cadastrada.</p>'
    return
  }

  const grupos = agruparPorPaisEAno(pedidos)
  inicGrupos(grupos)
  const wrap = document.createElement('div')
  wrap.className = 'pi-grupos-wrap'

  const paises = Object.keys(grupos).sort((a, b) => {
    if (a === 'Sem destino') return 1; if (b === 'Sem destino') return -1
    return a.localeCompare(b, 'pt-BR')
  })

  for (const pais of paises) {
    const anosGrupo  = grupos[pais]
    const totalPais  = Object.values(anosGrupo).flat().length
    const abertoPais = paisesAbertos.has(pais)

    const paisDiv = document.createElement('div')
    paisDiv.className = 'pais-grupo' + (abertoPais ? ' pais-aberto' : '')

    const paisBtn = document.createElement('button')
    paisBtn.className = 'pais-cabecalho'
    paisBtn.onclick = () => window.toggleGrupoPais(pais)
    paisBtn.innerHTML = `<span class="pais-chevron">${abertoPais ? '▼' : '▶'}</span>
      <span class="pais-nome">${pais}</span>
      <div class="pais-badges"><span class="pais-qtd">${totalPais} PI${totalPais > 1 ? 's' : ''}</span></div>`
    paisDiv.appendChild(paisBtn)

    if (abertoPais) {
      const paisCorpo = document.createElement('div')
      paisCorpo.className = 'pais-corpo'
      const anos = Object.keys(anosGrupo).sort((a, b) => Number(b) - Number(a))

      for (const ano of anos) {
        const chave  = pais + '|||' + ano
        const aberto = anosAbertos.has(chave)
        const pisDdoAno = anosGrupo[ano]

        const anoDiv = document.createElement('div')
        anoDiv.className = 'ano-grupo' + (aberto ? ' ano-aberto' : '')

        const anoBtn = document.createElement('button')
        anoBtn.className = 'ano-cabecalho'
        anoBtn.onclick = () => window.toggleGrupoAno(chave)
        anoBtn.innerHTML = `<span class="ano-chevron">${aberto ? '▼' : '▶'}</span>
          <span class="ano-label">${ano}</span>
          <span class="ano-qtd">${pisDdoAno.length} PI${pisDdoAno.length > 1 ? 's' : ''}</span>`
        anoDiv.appendChild(anoBtn)

        if (aberto) {
          const anoCorpo = document.createElement('div')
          anoCorpo.className = 'ano-corpo'
          for (const pedido of pisDdoAno) {
            const produtos = await api.produtos.listar(pedido.id)
            anoCorpo.appendChild(criarCardPi(pedido, produtos))
          }
          anoDiv.appendChild(anoCorpo)
        }
        paisCorpo.appendChild(anoDiv)
      }
      paisDiv.appendChild(paisCorpo)
    }
    wrap.appendChild(paisDiv)
  }
  listaPedidos.appendChild(wrap)

  listaPedidos.querySelectorAll('.btn-editar-qtd').forEach(b =>
    b.addEventListener('click', () => editarQuantidade(b.dataset.produtoId, b.dataset.quantidade))
  )
}

async function carregarPedidos() {
  const pedidos = await api.pedidos.listar()
  if (!pedidos) return
  todosOsPedidos = pedidos
  await renderizarLista(pedidos)
}

// ── Editar quantidade inline ─────────────────────────────────────
async function editarQuantidade(produtoId, quantidadeAtual) {
  const btn   = document.querySelector(`.btn-editar-qtd[data-produto-id="${produtoId}"]`)
  const label = document.getElementById(`qtd-label-${produtoId}`)
  if (!btn || !label) return
  const wrapper = btn.closest('.d-flex')
  if (wrapper.querySelector('.input-qtd-inline')) return

  const input     = document.createElement('input')
  input.type      = 'number'
  input.className = 'form-control form-control-sm input-qtd-inline'
  input.style.cssText = 'width:90px;border-radius:8px;'
  input.value = quantidadeAtual; input.min = '1'

  const btnS = document.createElement('button')
  const btnC = document.createElement('button')
  btnS.className = 'btn btn-sm btn-pietrobon'
  btnC.className = 'btn btn-sm btn-outline-secondary'
  btnS.style.cssText = btnC.style.cssText = 'border-radius:8px;padding:4px 10px;font-size:.8rem'
  btnS.textContent = '✔'; btnC.textContent = '✕'

  label.style.display = 'none'; btn.style.display = 'none'
  wrapper.appendChild(input); wrapper.appendChild(btnS); wrapper.appendChild(btnC)
  input.focus(); input.select()

  const cancelar = () => { input.remove(); btnS.remove(); btnC.remove(); label.style.display = ''; btn.style.display = '' }
  const salvar = async () => {
    const v = input.value
    if (!v || isNaN(v) || Number(v) <= 0) { input.focus(); return }
    btnS.disabled = true; btnS.textContent = '...'
    const r = await api.produtos.editarQuantidade(produtoId, v)
    if (r?.erro) { alert('Erro ao atualizar.'); btnS.disabled = false; btnS.textContent = '✔'; return }
    label.textContent = formatarQuantidade(v); btn.dataset.quantidade = v; cancelar()
  }
  btnS.addEventListener('click', salvar); btnC.addEventListener('click', cancelar)
  input.addEventListener('keydown', e => { if (e.key === 'Enter') salvar(); if (e.key === 'Escape') cancelar() })
}

async function excluirPi(piId, numeroPi) {
  if (!confirm(`Excluir a PI ${numeroPi}? Remove também os produtos, insumos e recebimentos.`)) return
  await api.pedidos.excluir(piId)
  primeiraVez = true; carregarPedidos()
}

// ── Form Nova PI ─────────────────────────────────────────────────
document.getElementById('btn-toggle-nova-pi').addEventListener('click', () => {
  const wrap = document.getElementById('form-nova-pi-wrap')
  const v = wrap.style.display !== 'none'
  wrap.style.display = v ? 'none' : 'block'
  if (!v) document.getElementById('numero-pi')?.focus()
})
document.getElementById('btn-cancelar-nova-pi').addEventListener('click', () => {
  document.getElementById('form-nova-pi-wrap').style.display = 'none'
  document.getElementById('form-novo-pi').reset()
})
document.getElementById('form-novo-pi').addEventListener('submit', async e => {
  e.preventDefault()
  const numeroPi = document.getElementById('numero-pi').value.trim()
  if (!numeroPi) return
  const btn = e.target.querySelector('[type="submit"]')
  btn.disabled = true; btn.textContent = 'Salvando...'
  const r = await api.pedidos.criar({
    numero_pi:     numeroPi,
    data_cadastro: document.getElementById('data-cadastro').value || null,
    cliente:       document.getElementById('cliente-pi').value.trim() || null,
    destino:       document.getElementById('destino-pi').value.trim() || null
  })
  btn.disabled = false; btn.textContent = '✔ Cadastrar'
  if (r?.erro) { alert('Erro ao cadastrar PI.'); return }
  e.target.reset()
  document.getElementById('form-nova-pi-wrap').style.display = 'none'
  window.toast?.success(`PI ${numeroPi} cadastrada!`)
  primeiraVez = true; carregarPedidos()
})

// ── Toggle catálogo ───────────────────────────────────────────────
document.getElementById('btn-toggle-catalogo')?.addEventListener('click', () => {
  const wrap = document.getElementById('catalogo-wrap')
  const btn  = document.getElementById('btn-toggle-catalogo')
  const v    = wrap.style.display !== 'none'
  wrap.style.display = v ? 'none' : 'block'
  btn.textContent = v ? '📦 Catálogo ▾' : '📦 Catálogo ▴'
})

// ── Iniciar ──────────────────────────────────────────────────────
async function iniciar() {
  const perfil = exigirPapel('todos')
  if (!perfil) return
  montarCabecalho(perfil.papel)
  window._convidado = perfil.papel !== 'admin'
  if (window._convidado) {
    const area = document.getElementById('area-admin')
    if (area) area.style.display = 'none'
  }
  carregarCatalogo()
  carregarPedidos()
}

iniciar()