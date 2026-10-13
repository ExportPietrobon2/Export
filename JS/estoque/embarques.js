import { api } from '/JS/core/api.js'
import { calcularStatusProduto, formatarQuantidade } from '/JS/core/constants.js'
import { exigirPapel } from '/JS/core/auth.js'
import { montarCabecalho } from '/JS/core/cabecalho.js'
import { piEmAlerta, bannerAlertaHtml, resumoAlertasHtml } from '/JS/core/alertas.js'
import { filtroPaisAno, paisDe, anoDe } from '/JS/core/pais-ano.js'
import { abrirPainel, corpoPainel, painelAbertoId, fecharPainel } from '/JS/core/painel.js'

const containerPis = document.getElementById('container-pis')
const toggleConcluidas = document.getElementById('toggle-concluidas')
const toggleSoProntas = document.getElementById('toggle-so-prontas')
let pedidosCache    = []

function prontaParaProduzir(pedido) {
 const produtos = pedido.produtos_pi || []
 if (produtos.length === 0) return false
 return produtos.every((p) => calcularStatusProduto(p.insumos_produto || []) === 'LIBERADO')
}

function dataParaInput(valor) {
 if (!valor) return ''
 return String(valor).slice(0, 10)
}

let podeEditarEmbarque = false

const rotuloInsumo = {
  embalagem: 'Embalagem',
  rotulo: 'Rótulo',
  caixa: 'Caixa',
  etiqueta: 'Etiqueta'
}



function renderAlmoxarifado(produtos) {
 if (!produtos || produtos.length === 0) {
 return '<p class="text-muted fst-italic small">Nenhum produto cadastrado.</p>'
 }
 return produtos.map((produto) => {
 const insumos = produto.insumos_produto || []
 const status = calcularStatusProduto(insumos)
 const liberado = status === 'LIBERADO'

 const linhasInsumos = insumos.map((insumo) => {
 let detalhes = ''
 if (insumo.tipo === 'caixa') {
 const sobra = Number(insumo.sobra) || 0
 const necessario = Number(produto.quantidade) || 0
 const suf = sobra >= necessario
 detalhes = `Sobra: ${sobra} cx · ${suf
 ? `<span class="texto-ok">✔ Suficiente (+${sobra - necessario} cx)</span>`
 : `<span class="texto-erro">✗ Faltam ${necessario - sobra} cx</span>`}`
 } else if (insumo.tipo === 'etiqueta') {
 const sobra = Number(insumo.sobra) || 0
 detalhes = sobra === 0
 ? '<span class="texto-erro">✗ Sem estoque</span>'
 : sobra < 100 ? `<span class="texto-alerta">⚠ Baixo (${sobra} un)</span>`
 : `${sobra} unidades`
 } else {
 const sobra = Number(insumo.sobra) || 0
 const pacotes = Number(insumo.quantidade_por_pacote) || 0
 detalhes = `Sobra: ${sobra} kg${pacotes > 0 ? ` · ${pacotes} pacotes` : ''}`
 }
 const nomeInsumo = insumo.tipo === 'rotulo' ? ('Rótulo' + (insumo.nome ? ' – ' + insumo.nome : '')) : (rotuloInsumo[insumo.tipo] || insumo.tipo)
 return `<tr><td>${nomeInsumo}</td><td>${insumo.confirmado ? '✔' : '✗'}</td><td>${detalhes}</td></tr>`
 }).join('')

 return `
 <div class="card border-0 bg-light rounded-3 p-3 mb-2"><div class="d-flex align-items-center gap-2 flex-wrap mb-2"><strong>${produto.produto}</strong><span class="badge bg-secondary">${formatarQuantidade(produto.quantidade)}</span><span class="badge ${liberado ? 'bg-success' : 'bg-danger'}">${status}</span></div>
 ${insumos.length > 0
 ? `<table class="table table-sm table-bordered mb-0 tabela-insumos-admin"><thead><tr><th>Insumo</th><th>OK</th><th>Estoque</th></tr></thead><tbody>${linhasInsumos}</tbody></table>`
 : '<p class="text-muted small mb-0 fst-italic">Sem dados do almoxarifado.</p>'}
 ${produto.observacoes ? `<div class="small text-muted mt-2">${produto.observacoes}</div>` : ''}
 </div>`
 }).join('')
}

function renderVinculosEstoque(vinculos) {
 if (!vinculos || vinculos.length === 0) {
 return '<p class="text-muted fst-italic small">Nenhum insumo do estoque geral vinculado a esta PI.</p>'
 }
 return vinculos.map((v) => {
 const dataEntrada = new Date(v.entrada_data).toLocaleString('pt-BR')
 const dataVinculo = new Date(v.criado_em).toLocaleString('pt-BR')
 return `
 <div class="border rounded-3 p-3 mb-2 bg-light"><div class="d-flex justify-content-between flex-wrap gap-1 mb-1">
 ${v.produto_entrada ? `<span class="fw-semibold small">${v.produto_entrada}</span>` : '<span class="text-muted small">Produto não informado</span>'}
 <span class="small text-muted">Vinculado em ${dataVinculo}</span></div><div class="d-flex gap-2 flex-wrap mb-1">
 ${v.embalagem_kg > 0 ? `<span class="badge bg-primary">${v.embalagem_kg} kg emb.</span>` : ''}
 ${v.rotulo_kg > 0 ? `<span class="badge bg-info text-dark">${v.rotulo_kg} kg rót.</span>` : ''}
 ${v.pallet_caixas > 0 ? `<span class="badge bg-secondary">${v.pallet_caixas} pallet(s)</span>` : ''}
 </div>
 ${v.entrada_localizacao ? `<div class="small mb-1"><span class="fw-semibold">${v.entrada_localizacao}</span></div>` : ''}
 <div class="small text-muted">Entrada do B2: ${dataEntrada}</div></div>`
 }).join('')
}

function renderRecebimentosB2(recebimentos) {
 if (!recebimentos || recebimentos.length === 0) {
 return '<p class="text-muted small fst-italic">Nenhum recebimento por PI registrado.</p>'
 }
 const porProduto = {}
 recebimentos.forEach((r) => {
 const chave = r.nome_produto || 'Geral'
 if (!porProduto[chave]) porProduto[chave] = []
 porProduto[chave].push(r)
 })
 return Object.entries(porProduto).map(([nomeProduto, itens]) => {
 const linhas = itens.map((r) => {
 const recebido = r.status_recebimento === 'recebido'
 const fotos = [
 r.foto_url ? `<a href="${r.foto_url}" target="_blank"><img src="${r.foto_url}" class="foto-detalhe-img rounded-2 me-1"></a>` : '',
 r.foto_nota_url ? `<a href="${r.foto_nota_url}" target="_blank"><img src="${r.foto_nota_url}" class="foto-detalhe-img rounded-2"></a>` : ''
 ].filter(Boolean).join('')
 return `<div class="d-flex align-items-start gap-2 flex-wrap mb-1"><span class="badge ${recebido ? 'bg-success' : 'bg-danger'}" style="min-width:90px;text-align:center">${rotuloInsumo[r.tipo] || r.tipo}</span>
 ${recebido && r.quantidade_recebida ? `<span class="badge bg-light text-dark border">${r.quantidade_recebida}</span>` : ''}
 ${!recebido ? '<span class="text-muted small">Pendente</span>' : ''}
 ${fotos ? `<div class="d-flex">${fotos}</div>` : ''}
 </div>`
 }).join('')
 return `<div class="mb-2"><div class="small fw-bold text-secondary mb-1">• ${nomeProduto}</div><div class="ps-2">${linhas}</div></div>`
 }).join('<hr class="my-2">')
}


const dataBR = (v) => v ? new Date(dataParaInput(v) + 'T00:00:00').toLocaleDateString('pt-BR') : ''

function construirLinha(pedido) {
 const pronta = prontaParaProduzir(pedido)
 const totalRecb = (pedido.recebimentos_b2 || []).length
 const recebidos = (pedido.recebimentos_b2 || []).filter((r) => r.status_recebimento === 'recebido').length
 const emAlerta = piEmAlerta(pedido)
 const linha = document.createElement('button')
 linha.type = 'button'
 linha.className = [
  'pi-linha',
  pedido.concluida ? 'pi-linha-concluida' : '',
  (pronta && pedido.data_embarque && !pedido.concluida) ? 'pi-linha-ok' : '',
  emAlerta ? 'pi-linha-alerta' : ''
 ].filter(Boolean).join(' ')
 linha.dataset.id = pedido.id
 linha.dataset.pais = paisDe(pedido.destino)
 linha.dataset.ano = anoDe(pedido.data_embarque || pedido.data_cadastro)
 linha.innerHTML = `
  <span class="pi-linha-num">PI ${pedido.numero_pi}</span>
  <span class="pi-linha-info">
   <span class="pi-linha-cliente">${pedido.cliente || '—'}</span>
   <span class="pi-linha-meta">${paisDe(pedido.destino)} · ${pedido.data_embarque ? 'Embarque ' + dataBR(pedido.data_embarque) : 'Sem data de embarque'}</span>
  </span>
  <span class="pi-linha-selos">
   ${emAlerta ? '<span class="badge bg-danger">Embarque próximo</span>' : ''}
   ${pedido.comentario_embarque ? '<span class="badge bg-primary">💬 Cobrança</span>' : ''}
   ${totalRecb > 0 ? `<span class="pi-linha-mini">B2 ${recebidos}/${totalRecb}</span>` : ''}
   <span class="badge ${pronta ? 'bg-success' : 'bg-danger'}">${pronta ? 'Pronto para produzir' : 'Não pronto'}</span>
  </span>
  <span class="pi-linha-seta" aria-hidden="true">›</span>`
 return linha
}

function construirDetalhe(pedido) {
 const detalhe = document.createElement('div')
 if (piEmAlerta(pedido)) detalhe.insertAdjacentHTML('beforeend', bannerAlertaHtml(pedido))

 const secEmbarque = document.createElement('div')
 secEmbarque.className = 'mt-2'
 secEmbarque.innerHTML = podeEditarEmbarque ? `
 <div class="secao-titulo-card mb-2">Data de Embarque</div><div class="d-flex align-items-end gap-2 flex-wrap"><div><label class="form-label small fw-semibold mb-1">Data</label><input type="date" id="embarque-input-${pedido.id}" class="form-control form-control-sm" value="${dataParaInput(pedido.data_embarque)}" style="max-width:200px"></div><button class="btn btn-sm btn-pietrobon btn-salvar-embarque" data-pid="${pedido.id}" data-numeropi="${pedido.numero_pi}" id="embarque-btn-${pedido.id}">💾 Salvar data</button><span class="small ms-1" id="embarque-msg-${pedido.id}"></span></div>
 ` : `
 <div class="secao-titulo-card mb-2">Data de Embarque</div><div class="fw-semibold">${pedido.data_embarque ? dataBR(pedido.data_embarque) : '— não definida'}</div>
 `

 const secAlmox = document.createElement('div')
 secAlmox.className = 'mt-3'
 secAlmox.innerHTML = `<div class="secao-titulo-card mb-2">Insumos por Produto (Almoxarifado)</div>${renderAlmoxarifado(pedido.produtos_pi)}`

 const secEstoque = document.createElement('div')
 secEstoque.className = 'mt-3'
 secEstoque.innerHTML = `<div class="secao-titulo-card mb-2">Estoque Geral Vinculado</div>${renderVinculosEstoque(pedido.vinculos_estoque)}`

 const secB2 = document.createElement('div')
 secB2.className = 'mt-3'
 secB2.innerHTML = `<div class="secao-titulo-card mb-2">Recebimentos B2 por PI</div>${renderRecebimentosB2(pedido.recebimentos_b2)}`

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
 return detalhe
}

function abrirDetalhe(id) {
 const pedido = pedidosCache.find((p) => String(p.id) === String(id))
 if (!pedido) return
 const pronta = prontaParaProduzir(pedido)
 abrirPainel({
  id: pedido.id,
  titulo: `PI ${pedido.numero_pi}`,
  subtitulo: `${pedido.cliente || ''}${pedido.destino ? ' · ' + paisDe(pedido.destino) : ''}`,
  selos: `<span class="badge ${pronta ? 'bg-success' : 'bg-danger'}">${pronta ? 'Pronto para produzir' : 'Não pronto'}</span>`,
  conteudo: construirDetalhe(pedido)
 })
}

function atualizarPainel() {
 const id = painelAbertoId()
 if (!id) return
 const foco = document.activeElement
 if (foco && corpoPainel().contains(foco) && /INPUT|TEXTAREA|SELECT/.test(foco.tagName)) return
 if (pedidosCache.some((p) => String(p.id) === id)) abrirDetalhe(id)
 else fecharPainel()
}

async function salvarEmbarque(piId, numeroPi) {
 const input = document.getElementById(`embarque-input-${piId}`)
 const btn = document.querySelector(`.btn-salvar-embarque[data-pid="${piId}"]`)
 const msg = document.getElementById(`embarque-msg-${piId}`)
 if (!input) return

 if (btn) { btn.disabled = true; btn.textContent = 'Salvando...' }
 msg.textContent = ''

 const resultado = await api.pedidos.editarEmbarque(piId, input.value || null)
 if (resultado?.erro) {
 if (msg) { msg.className = 'small ms-1 text-danger'; msg.textContent = 'Erro ao salvar.' }
 if (btn) { btn.disabled = false; btn.textContent = '💾 Salvar data' }
 return
 }

 if (msg) { msg.className = 'small ms-1 text-success fw-semibold'; msg.textContent = input.value ? 'Data salva' : 'Data removida' }
 if (btn) { btn.disabled = false; btn.textContent = '💾 Salvar data' }

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

  const ordenados = [...lista].sort((a, b) =>
    paisDe(a.destino).localeCompare(paisDe(b.destino), 'pt-BR') ||
    String(a.data_embarque || '9999').localeCompare(String(b.data_embarque || '9999')))

  const wrap = document.createElement('div')
  wrap.className = 'pi-lista'
  ordenados.forEach((p) => wrap.appendChild(construirLinha(p)))
  containerPis.appendChild(wrap)
  filtroPaisAno(wrap, { chave: 'embarques' })
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
  atualizarPainel()
}

containerPis.addEventListener('click', (e) => {
 const linha = e.target.closest('.pi-linha')
 if (linha) abrirDetalhe(linha.dataset.id)
})

corpoPainel().addEventListener('click', (e) => {
 const btnEmbarque = e.target.closest('.btn-salvar-embarque')
 if (btnEmbarque) salvarEmbarque(Number(btnEmbarque.dataset.pid), btnEmbarque.dataset.numeropi)
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