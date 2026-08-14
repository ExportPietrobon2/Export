import { api } from '/JS/core/api.js'
import { calcularStatusProduto, formatarQuantidade } from '/JS/core/constants.js'
import { exigirPapel } from '/JS/core/auth.js'
import { montarCabecalho } from '/JS/core/cabecalho.js'
import { piEmAlerta, bannerAlertaHtml, resumoAlertasHtml } from '/JS/core/alertas.js'

const containerPis = document.getElementById('container-pis')
const toggleConcluidas = document.getElementById('toggle-concluidas')
const toggleSoProntas = document.getElementById('toggle-so-prontas')
const abertos      = new Set()
const paisesAbertos = new Set()
const anosAbertos   = new Set()
let pedidosCache    = []
let primeiraVez     = true

// ── Agrupamento ────────────────────────────────────────────────
function extrarAno(d) { if (!d) return 'Sem data'; return String(new Date(String(d).slice(0,10)+'T00:00:00').getFullYear()) }
function agruparPorPaisEAno(pedidos) {
  const g = {}
  for (const p of pedidos) {
    const pais = (p.destino||'').trim()||'Sem destino'
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
  const anoAtual = String(new Date().getFullYear())
  Object.entries(grupos).forEach(([pais, anos]) => {
    paisesAbertos.add(pais)
    const lista = Object.keys(anos).sort((a,b)=>Number(b)-Number(a))
    const abrir = lista.includes(anoAtual) ? anoAtual : lista[0]
    if (abrir) anosAbertos.add(pais+'|||'+abrir)
  })
}
window.toggleGrupoPais = function(pais) {
  if (paisesAbertos.has(pais)) paisesAbertos.delete(pais); else paisesAbertos.add(pais)
  renderizarPis(pedidosCache)
}
window.toggleGrupoAno = function(chave) {
  if (anosAbertos.has(chave)) anosAbertos.delete(chave); else anosAbertos.add(chave)
  renderizarPis(pedidosCache)
}

function renderCard(pedido) {
 const pronta = prontaParaProduzir(pedido)
 const totalRecb = (pedido.recebimentos_b2 || []).length
 const recebidos = (pedido.recebimentos_b2 || []).filter((r) => r.status_recebimento === 'recebido').length

 const emAlerta = piEmAlerta(pedido)
 const aberto = abertos.has(String(pedido.id))
 const card = document.createElement('div')
 card.className = `card card-pi-admin mb-3${pedido.concluida ? ' pi-concluida' : ''}${emAlerta ? ' card-alerta-embarque' : ''}${(pronta && pedido.data_embarque && !pedido.concluida) ? ' card-ok' : ''}`

 if (emAlerta) {
 const banner = document.createElement('div')
 banner.innerHTML = bannerAlertaHtml(pedido)
 card.appendChild(banner.firstElementChild)
 }

 const cabecalho = document.createElement('div')
 cabecalho.className = 'card-body d-flex justify-content-between align-items-start flex-wrap gap-2'
 cabecalho.innerHTML = `
 <div><div class="fw-bold fs-6">PI ${pedido.numero_pi}</div><div class="text-muted small">
 ${pedido.cliente || ''}
 ${pedido.destino ? '· ' + pedido.destino : ''}
 ${pedido.data_cadastro ? '· Cadastro ' + new Date(dataParaInput(pedido.data_cadastro) + 'T00:00:00').toLocaleDateString('pt-BR') : ''}
 ${pedido.data_embarque ? '· Embarque ' + new Date(dataParaInput(pedido.data_embarque) + 'T00:00:00').toLocaleDateString('pt-BR') : ''}
 </div><div class="mt-1 d-flex align-items-center gap-2 flex-wrap"><span class="badge ${pronta ? 'bg-success' : 'bg-danger'}">${pronta ? 'Pronto para produzir' : '⏳ Não pronto'}</span>
 ${pedido.comentario_embarque ? `<span class="badge bg-primary">💬 ${pedido.comentario_usuario || 'Admin'}</span>` : ''}
 ${totalRecb > 0 ? `<span class="small text-muted">Receb. B2: ${recebidos}/${totalRecb}</span>` : ''}
 </div></div><button class="btn btn-sm btn-outline-danger btn-expandir" data-id="${pedido.id}">${aberto ? 'Fechar ▴' : 'Ver detalhes ▾'}</button>
 `

 const detalhe = document.createElement('div')
 detalhe.id = `detalhe-${pedido.id}`
 detalhe.style.display = aberto ? 'block' : 'none'
 detalhe.className = 'border-top px-3 pb-3'

 const secEmbarque = document.createElement('div')
 secEmbarque.className = 'mt-3'
 secEmbarque.innerHTML = podeEditarEmbarque ? `
 <div class="secao-titulo-card mb-2">Data de Embarque</div><div class="d-flex align-items-end gap-2 flex-wrap"><div><label class="form-label small fw-semibold mb-1">Data</label><input type="date" id="embarque-input-${pedido.id}" class="form-control form-control-sm" value="${dataParaInput(pedido.data_embarque)}" style="max-width:200px"></div><button class="btn btn-sm btn-pietrobon" id="embarque-btn-${pedido.id}">💾 Salvar data</button><span class="small ms-1" id="embarque-msg-${pedido.id}"></span></div>
 ` : `
 <div class="secao-titulo-card mb-2">Data de Embarque</div><div class="fw-semibold">${pedido.data_embarque ? new Date(dataParaInput(pedido.data_embarque) + 'T00:00:00').toLocaleDateString('pt-BR') : '— não definida'}</div>
 `

 const secAlmox = document.createElement('div')
 secAlmox.className = 'mt-3'
 secAlmox.innerHTML = `
 <div class="secao-titulo-card mb-2">Insumos por Produto (Almoxarifado)</div>
 ${renderAlmoxarifado(pedido.produtos_pi)}
 `

 const secEstoque = document.createElement('div')
 secEstoque.className = 'mt-3'
 secEstoque.innerHTML = `
 <div class="secao-titulo-card mb-2">Estoque Geral Vinculado</div>
 ${renderVinculosEstoque(pedido.vinculos_estoque)}
 `

 const secB2 = document.createElement('div')
 secB2.className = 'mt-3'
 secB2.innerHTML = `
 <div class="secao-titulo-card mb-2">Recebimentos B2 por PI</div>
 ${renderRecebimentosB2(pedido.recebimentos_b2)}
 `

 if (pedido.comentario_embarque) {
 const secComentario = document.createElement('div')
 secComentario.className = 'mt-3'
 secComentario.innerHTML = `<div class="alert alert-primary mb-0"><strong>Comentário de:</strong> ${pedido.comentario_usuario || 'Admin'}<br>${pedido.comentario_embarque}</div>`
 detalhe.appendChild(secComentario)
 }

 detalhe.appendChild(secEmbarque)
 detalhe.appendChild(secAlmox)
 detalhe.appendChild(secEstoque)
 detalhe.appendChild(secB2)

 card.appendChild(cabecalho)
 card.appendChild(detalhe)
 return card
}

async function salvarEmbarque(piId, numeroPi) {
 const input = document.getElementById(`embarque-input-${piId}`)
 const btn = document.getElementById(`embarque-btn-${piId}`)
 const msg = document.getElementById(`embarque-msg-${piId}`)
 if (!input || !btn) return

 btn.disabled = true
 btn.textContent = 'Salvando...'
 msg.textContent = ''

 const resultado = await api.pedidos.editarEmbarque(piId, input.value || null)
 if (resultado?.erro) {
 msg.className = 'small ms-1 text-danger'
 msg.textContent = 'Erro ao salvar.'
 btn.disabled = false
 btn.textContent = '💾 Salvar data'
 return
 }

 msg.className = 'small ms-1 text-success fw-semibold'
 msg.textContent = input.value ? 'Data salva' : 'Data removida'
 btn.disabled = false
 btn.textContent = '💾 Salvar data'

 setTimeout(carregar, 900)
}


function renderizarPis(pedidos) {
  const soPromtas = toggleSoProntas.checked
  const lista = soPromtas ? pedidos.filter((p) => prontaParaProduzir(p)) : pedidos

  containerPis.innerHTML = ''
  const resumoAlerta = resumoAlertasHtml(pedidos)
  if (resumoAlerta) containerPis.insertAdjacentHTML('beforeend', resumoAlerta)

  if (!lista.length) {
    const vazio = document.createElement('p')
    vazio.className = 'text-muted fst-italic'; vazio.textContent = 'Nenhuma PI para exibir.'
    containerPis.appendChild(vazio); return
  }

  const grupos = agruparPorPaisEAno(lista)
  inicGrupos(grupos)

  const wrap = document.createElement('div'); wrap.className = 'pi-grupos-wrap'

  const paises = Object.keys(grupos).sort((a,b) => {
    if (a === 'Sem destino') return 1; if (b === 'Sem destino') return -1
    return a.localeCompare(b, 'pt-BR')
  })

  for (const pais of paises) {
    const anosGrupo = grupos[pais]
    const totalPais = Object.values(anosGrupo).flat().length
    const abertoPais = paisesAbertos.has(pais)

    const paisDiv = document.createElement('div')
    paisDiv.className = 'pais-grupo' + (abertoPais ? ' pais-aberto' : '')

    const btn = document.createElement('button')
    btn.className = 'pais-cabecalho'
    btn.onclick = () => window.toggleGrupoPais(pais)
    btn.innerHTML = `<span class="pais-chevron">${abertoPais ? '▼' : '▶'}</span><span class="pais-nome">${pais}</span><div class="pais-badges"><span class="pais-qtd">${totalPais} PI${totalPais>1?'s':''}</span></div>`
    paisDiv.appendChild(btn)

    if (abertoPais) {
      const paisCorpo = document.createElement('div'); paisCorpo.className = 'pais-corpo'
      const anos = Object.keys(anosGrupo).sort((a,b) => Number(b)-Number(a))
      for (const ano of anos) {
        const chave = pais+'|||'+ano
        const aberto = anosAbertos.has(chave)
        const pisDdoAno = anosGrupo[ano]

        const anoDiv = document.createElement('div')
        anoDiv.className = 'ano-grupo' + (aberto ? ' ano-aberto' : '')

        const anoBtn = document.createElement('button'); anoBtn.className = 'ano-cabecalho'
        anoBtn.onclick = () => window.toggleGrupoAno(chave)
        anoBtn.innerHTML = `<span class="ano-chevron">${aberto?'▼':'▶'}</span><span class="ano-label">${ano}</span><span class="ano-qtd">${pisDdoAno.length} PI${pisDdoAno.length>1?'s':''}</span>`
        anoDiv.appendChild(anoBtn)

        if (aberto) {
          const anoCorpo = document.createElement('div'); anoCorpo.className = 'ano-corpo'
          pisDdoAno.forEach(p => {
            const card = renderCard(p)
            anoCorpo.appendChild(card)
          })
          anoDiv.appendChild(anoCorpo)
        }
        paisCorpo.appendChild(anoDiv)
      }
      paisDiv.appendChild(paisCorpo)
    }
    wrap.appendChild(paisDiv)
  }
  containerPis.appendChild(wrap)

  // Bind embarque buttons
  lista.forEach((pedido) => {
    const btn = document.getElementById(`embarque-btn-${pedido.id}`)
    if (btn) btn.addEventListener('click', () => salvarEmbarque(pedido.id, pedido.numero_pi))
  })
}

async function carregar() {
  const incluirConcluidas = toggleConcluidas.checked
  containerPis.innerHTML = '<p class="text-muted">Carregando...</p>'
  const pedidos = await api.pedidos.completo(incluirConcluidas)
  if (!pedidos) { containerPis.innerHTML = '<p class="text-danger">Erro ao carregar. Verifique a conexão.</p>'; return }

  pedidosCache = pedidos

  const prontas     = pedidos.filter((p) => prontaParaProduzir(p) && !p.concluida).length
  const naoProntas  = pedidos.filter((p) => !prontaParaProduzir(p) && !p.concluida).length
  const comEmbarque = pedidos.filter((p) => p.data_embarque && !p.concluida).length
  const semEmbarque = pedidos.filter((p) => !p.data_embarque && !p.concluida).length
  document.getElementById('numero-prontas').textContent = prontas
  document.getElementById('numero-nao-prontas').textContent = naoProntas
  document.getElementById('numero-com-embarque').textContent = comEmbarque
  document.getElementById('numero-sem-embarque').textContent = semEmbarque

  renderizarPis(pedidos)
}

containerPis.addEventListener('click', (e) => {
 const btnExpandir = e.target.closest('.btn-expandir')
 if (!btnExpandir) return
 const id = btnExpandir.dataset.id
 const detalhe = document.getElementById(`detalhe-${id}`)
 if (!detalhe) return
 const aberto = detalhe.style.display !== 'none'
 detalhe.style.display = aberto ? 'none' : 'block'
 btnExpandir.textContent = aberto ? 'Ver detalhes ▾' : 'Fechar ▴'
 if (aberto) abertos.delete(String(id)); else abertos.add(String(id))
})

toggleConcluidas.addEventListener('change', carregar)
toggleSoProntas.addEventListener('change', carregar)

function editandoData() {
 const el = document.activeElement
 return !!(el && el.id && el.id.startsWith('embarque-input-'))
}
setInterval(() => { if (!editandoData()) carregar() }, 5 * 60 * 1000)

document.addEventListener('visibilitychange', () => {
 if (document.visibilityState === 'visible' && !editandoData()) carregar()
})

async function iniciar() {
 const perfil = exigirPapel('todos')
 if (!perfil) return
 podeEditarEmbarque = ['admin', 'gerente_producao'].includes(perfil.papel)
 montarCabecalho(perfil.papel)
 carregar()
}

iniciar()