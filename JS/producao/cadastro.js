import { api } from '/JS/core/api.js'
import { TIPOS_INSUMO, formatarQuantidade } from '/JS/core/constants.js'
import { exigirPapel } from '/JS/core/auth.js'
import { montarCabecalho } from '/JS/core/cabecalho.js'

const listaPedidos  = document.getElementById('lista-pedidos')
const paisesAbertos = new Set()
const anosAbertos   = new Set()
let primeiraVez     = true
let todosOsPedidos  = []

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
function inicGrupos(grupos) {
  if (!primeiraVez) return
  primeiraVez = false
}
window.toggleGrupoPais = function(pais) {
  if (paisesAbertos.has(pais)) paisesAbertos.delete(pais); else paisesAbertos.add(pais)
  renderizarLista(todosOsPedidos).catch(e => console.error(e))
}
window.toggleGrupoAno = function(chave) {
  if (anosAbertos.has(chave)) anosAbertos.delete(chave); else anosAbertos.add(chave)
  renderizarLista(todosOsPedidos).catch(e => console.error(e))
}

// ── Toggle form adicionar produto inline ─────────────────────────
window.toggleFormProduto = function(piId) {
  const form = document.getElementById(`form-add-${piId}`)
  const btn  = document.getElementById(`btn-add-prod-${piId}`)
  if (!form) return
  const visivel = form.style.display !== 'none'
  form.style.display = visivel ? 'none' : 'block'
  if (btn) btn.textContent = visivel ? '➕ Adicionar produto' : '✕ Cancelar'
  if (!visivel) document.getElementById(`inp-prod-nome-${piId}`)?.focus()
}

window.salvarProdutoInline = async function(piId) {
  const inpNome = document.getElementById(`inp-prod-nome-${piId}`)
  const inpQtd  = document.getElementById(`inp-prod-qtd-${piId}`)
  const nome = inpNome?.value.trim()
  const qtd  = inpQtd?.value
  if (!nome) { inpNome?.focus(); return }
  if (!qtd || Number(qtd) <= 0) { inpQtd?.focus(); return }

  const btnSalvar = document.getElementById(`btn-salvar-prod-${piId}`)
  if (btnSalvar) { btnSalvar.disabled = true; btnSalvar.textContent = '...' }

  const resultado = await api.produtos.criar({ pi_id: piId, produto: nome, quantidade: qtd })

  if (resultado?.erro) {
    alert('Erro ao cadastrar produto.')
    if (btnSalvar) { btnSalvar.disabled = false; btnSalvar.textContent = 'Adicionar' }
    return
  }

  if (inpNome) inpNome.value = ''
  if (inpQtd) inpQtd.value = ''
  if (btnSalvar) { btnSalvar.disabled = false; btnSalvar.textContent = 'Adicionar' }
  window.toast?.success('Produto adicionado!')
  renderizarLista(todosOsPedidos).catch(e => console.error(e))
}

// ── Card de PI com form inline de produto ────────────────────────
function criarCardPi(pedido, produtos) {
  const bloco = document.createElement('div')
  bloco.className = 'card border-0 shadow-sm mb-2'

  // Cabeçalho da PI
  const cabecalho = document.createElement('div')
  cabecalho.className = 'card-body d-flex justify-content-between align-items-center flex-wrap gap-2 py-3'
  const dataCadFmt = pedido.data_cadastro
    ? ' · ' + new Date(String(pedido.data_cadastro).slice(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR')
    : ''
  cabecalho.innerHTML = `
    <div>
      <strong class="text-danger">PI ${pedido.numero_pi}</strong>
      <span class="text-muted small"> — ${pedido.cliente || 'sem cliente'}${dataCadFmt}</span>
    </div>`
  if (!window._convidado) {
    const btnExcluir = document.createElement('button')
    btnExcluir.type = 'button'
    btnExcluir.className = 'btn btn-sm btn-outline-danger'
    btnExcluir.style.borderRadius = '8px'
    btnExcluir.textContent = 'Excluir PI'
    btnExcluir.addEventListener('click', () => excluirPi(pedido.id, pedido.numero_pi))
    cabecalho.appendChild(btnExcluir)
  }
  bloco.appendChild(cabecalho)

  // Lista de produtos
  const lista = document.createElement('ul')
  lista.className = 'list-group list-group-flush'
  lista.id = `produtos-pi-${pedido.id}`

  if (!produtos || !produtos.length) {
    const vazio = document.createElement('li')
    vazio.className = 'list-group-item text-muted fst-italic small py-2'
    vazio.textContent = 'Nenhum produto cadastrado ainda.'
    lista.appendChild(vazio)
  } else {
    produtos.forEach((produto) => {
      const item = document.createElement('li')
      item.className = 'list-group-item d-flex align-items-center justify-content-between gap-2 py-2'
      item.innerHTML = `
        <span class="small fw-semibold">${produto.produto}</span>
        <div class="d-flex align-items-center gap-2">
          <span class="badge bg-light text-dark border" id="qtd-label-${produto.id}">${formatarQuantidade(produto.quantidade)}</span>
          ${!window._convidado
            ? `<button class="btn btn-sm btn-outline-warning btn-editar-qtd"
                data-produto-id="${produto.id}" data-quantidade="${produto.quantidade}"
                style="border-radius:8px;font-size:.78rem">Editar qtd</button>`
            : ''
          }
        </div>`
      lista.appendChild(item)
    })
  }
  bloco.appendChild(lista)

  // Form inline para adicionar produto (somente admin)
  if (!window._convidado) {
    const footer = document.createElement('div')
    footer.className = 'px-3 pb-3'
    footer.innerHTML = `
      <button class="btn-add-produto-inline" id="btn-add-prod-${pedido.id}"
        onclick="toggleFormProduto(${pedido.id})">
        ➕ Adicionar produto
      </button>
      <div class="form-add-produto" id="form-add-${pedido.id}" style="display:none">
        <div class="row g-2 align-items-center">
          <div class="col">
            <input type="text" class="form-control form-control-sm" id="inp-prod-nome-${pedido.id}"
              placeholder="Nome do produto"
              onkeydown="if(event.key==='Enter'){event.preventDefault();salvarProdutoInline(${pedido.id})}">
          </div>
          <div class="col-auto">
            <input type="number" class="form-control form-control-sm" id="inp-prod-qtd-${pedido.id}"
              placeholder="Qtd (cx)" min="1" style="width:90px"
              onkeydown="if(event.key==='Enter'){event.preventDefault();salvarProdutoInline(${pedido.id})}">
          </div>
          <div class="col-auto d-flex gap-1">
            <button class="btn btn-sm btn-pietrobon" id="btn-salvar-prod-${pedido.id}"
              onclick="salvarProdutoInline(${pedido.id})" style="border-radius:8px">Adicionar</button>
            <button class="btn btn-sm btn-outline-secondary"
              onclick="toggleFormProduto(${pedido.id})" style="border-radius:8px">✕</button>
          </div>
        </div>
      </div>`
    bloco.appendChild(footer)
  }

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
    if (a === 'Sem destino') return 1
    if (b === 'Sem destino') return -1
    return a.localeCompare(b, 'pt-BR')
  })

  for (const pais of paises) {
    const anosGrupo = grupos[pais]
    const totalPais = Object.values(anosGrupo).flat().length
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
        const chave = pais + '|||' + ano
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

  const input = document.createElement('input')
  input.type = 'number'
  input.className = 'form-control form-control-sm input-qtd-inline'
  input.style.cssText = 'width:90px;border-radius:8px;'
  input.value = quantidadeAtual
  input.min = '1'

  const btnSalvar   = document.createElement('button')
  const btnCancelar = document.createElement('button')
  btnSalvar.className   = 'btn btn-sm btn-pietrobon'
  btnCancelar.className = 'btn btn-sm btn-outline-secondary'
  btnSalvar.style.cssText   = 'border-radius:8px;padding:4px 10px;font-size:.8rem'
  btnCancelar.style.cssText = 'border-radius:8px;padding:4px 10px;font-size:.8rem'
  btnSalvar.textContent   = '✔'
  btnCancelar.textContent = '✕'

  label.style.display = 'none'
  btn.style.display   = 'none'
  wrapper.appendChild(input)
  wrapper.appendChild(btnSalvar)
  wrapper.appendChild(btnCancelar)
  input.focus(); input.select()

  const cancelar = () => {
    input.remove(); btnSalvar.remove(); btnCancelar.remove()
    label.style.display = ''; btn.style.display = ''
  }
  const salvar = async () => {
    const novaQtd = input.value
    if (!novaQtd || isNaN(novaQtd) || Number(novaQtd) <= 0) { input.focus(); return }
    btnSalvar.disabled = true; btnSalvar.textContent = '...'
    const resultado = await api.produtos.editarQuantidade(produtoId, novaQtd)
    if (resultado?.erro) {
      alert('Erro ao atualizar quantidade.')
      btnSalvar.disabled = false; btnSalvar.textContent = '✔'
      return
    }
    label.textContent = formatarQuantidade(novaQtd)
    btn.dataset.quantidade = novaQtd
    cancelar()
  }
  btnSalvar.addEventListener('click', salvar)
  btnCancelar.addEventListener('click', cancelar)
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') salvar()
    if (e.key === 'Escape') cancelar()
  })
}

async function excluirPi(piId, numeroPi) {
  if (!confirm(`Excluir a PI ${numeroPi}? Esta ação remove também os produtos, insumos e recebimentos. Não pode ser desfeito.`)) return
  await api.pedidos.excluir(piId)
  primeiraVez = true
  carregarPedidos()
}

// ── Form Nova PI (collapsível) ───────────────────────────────────
document.getElementById('btn-toggle-nova-pi').addEventListener('click', () => {
  const wrap = document.getElementById('form-nova-pi-wrap')
  const visivel = wrap.style.display !== 'none'
  wrap.style.display = visivel ? 'none' : 'block'
  if (!visivel) document.getElementById('numero-pi')?.focus()
})

document.getElementById('btn-cancelar-nova-pi').addEventListener('click', () => {
  document.getElementById('form-nova-pi-wrap').style.display = 'none'
  document.getElementById('form-novo-pi').reset()
})

document.getElementById('form-novo-pi').addEventListener('submit', async (e) => {
  e.preventDefault()
  const numeroPi = document.getElementById('numero-pi').value.trim()
  if (!numeroPi) return
  const btnSubmit = e.target.querySelector('[type="submit"]')
  btnSubmit.disabled = true; btnSubmit.textContent = 'Salvando...'

  const resultado = await api.pedidos.criar({
    numero_pi: numeroPi,
    data_cadastro: document.getElementById('data-cadastro').value || null,
    cliente: document.getElementById('cliente-pi').value.trim() || null,
    destino: document.getElementById('destino-pi').value.trim() || null
  })

  btnSubmit.disabled = false; btnSubmit.textContent = '✔ Cadastrar'
  if (resultado?.erro) { alert('Erro ao cadastrar PI.'); return }

  e.target.reset()
  document.getElementById('form-nova-pi-wrap').style.display = 'none'
  window.toast?.success(`PI ${numeroPi} cadastrada!`)
  primeiraVez = true
  carregarPedidos()
})

// ── Iniciar ──────────────────────────────────────────────────────
async function iniciar() {
  const perfil = exigirPapel('todos')
  if (!perfil) return
  montarCabecalho(perfil.papel)
  window._convidado = perfil.papel !== 'admin'
  if (window._convidado) {
    document.getElementById('area-admin').style.display = 'none'
  }
  carregarPedidos()
}

iniciar()