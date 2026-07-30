import { api } from ''/JS/core/api.js''

const STATUS_INFO = {
  pendente: { rotulo: ''Pendente'', cor: ''bg-warning text-dark'' },
  tem: { rotulo: ''✔ Tem'', cor: ''bg-success'' },
  nao_tem: { rotulo: ''✗ Não tem'', cor: ''bg-danger'' }
}

const CATEGORIA_INFO = {
  gerais: { rotulo: ''Insumos gerais'', cor: ''bg-secondary'' },
  aromas: { rotulo: ''Aromas'', cor: ''bg-info text-dark'' }
}

let wrapperGlobal = null
let podeCriar = false
let categoriasQuePodemResponder = []

function gerarFormulario() {
  return `
    <div class="card border-0 shadow-sm mb-4" id="card-novo-pedido">
      <div class="card-body">
        <h5 class="fw-bold mb-3">Novo pedido ao setor de Compras</h5>
        <form id="form-pedido-compra">
          <div class="row g-3">
            <div class="col-12 col-md-5">
              <label class="form-label fw-semibold small">O que está faltando *</label>
              <input type="text" id="pc-descricao" class="form-control"
                placeholder="Ex.: Embalagem Bala Dura 250g" required>
            </div>
            <div class="col-6 col-md-3">
              <label class="form-label fw-semibold small">Categoria</label>
              <select id="pc-categoria" class="form-select">
                <option value="gerais">Insumos gerais (embalagem, caixa, rótulo)</option>
                <option value="aromas">Aromas</option>
              </select>
            </div>
            <div class="col-6 col-md-2">
              <label class="form-label fw-semibold small">Quantidade</label>
              <input type="number" id="pc-quantidade" class="form-control" placeholder="0" min="0" step="any">
            </div>
            <div class="col-6 col-md-2">
              <label class="form-label fw-semibold small">Unidade</label>
              <input type="text" id="pc-unidade" class="form-control" placeholder="kg / un / cx">
            </div>
            <div class="col-12 col-md-3">
              <label class="form-label fw-semibold small">PI (opcional)</label>
              <select id="pc-pi" class="form-select">
                <option value="">—</option>
              </select>
            </div>
          </div>
          <button type="submit" class="btn btn-ok-grande w-100 mt-3" id="pc-btn-enviar">
            📨 Enviar pedido
          </button>
        </form>
      </div>
    </div>`
}

async function preencherSelectPis() {
  const select = wrapperGlobal.querySelector(''#pc-pi'')
  if (!select) return

  const pedidos = await api.pedidos.listar()
  if (!Array.isArray(pedidos)) return

  pedidos.forEach((p) => {
    const opcao = document.createElement(''option'')
    opcao.value = p.id
    opcao.textContent = `PI ${p.numero_pi}${p.cliente ? '' — '' + p.cliente : ''''}`
    select.appendChild(opcao)
  })
}

async function carregarLista() {
  const container = wrapperGlobal.querySelector(''#lista-pedidos-compra'')
  if (!container) return

  const registros = await api.demandas.listar()
  if (!Array.isArray(registros)) {
    container.innerHTML = ''<p class="text-danger">Não foi possível carregar os pedidos.</p>''
    return
  }

  if (!registros.length) {
    container.innerHTML = ''<p class="text-muted fst-italic">Nenhum pedido registrado.</p>''
    return
  }

  container.innerHTML = registros.map((d) => {
    const status = STATUS_INFO[d.status] || STATUS_INFO.pendente
    const categoria = CATEGORIA_INFO[d.categoria] || CATEGORIA_INFO.gerais
    const podeResponder = categoriasQuePodemResponder.includes(d.categoria || ''gerais'')

    return `
      <div class="card border-0 shadow-sm mb-2">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-1">
            <div>
              <div class="fw-bold">${d.descricao}</div>
              <div class="small text-muted">
                ${d.quantidade > 0 ? `${d.quantidade} ${d.unidade || ''''}` : ''''}
                ${d.numero_pi ? ` · PI ${d.numero_pi}` : ''''}
                ${d.solicitante ? ` · Solicitante: ${d.solicitante}` : ''''}
              </div>
            </div>
            <div class="d-flex gap-1 flex-wrap justify-content-end">
              <span class="badge ${categoria.cor}">${categoria.rotulo}</span>
              <span class="badge ${status.cor}">${status.rotulo}</span>
            </div>
          </div>
          ${d.respondido_por ? `<div class="small text-muted mb-2">Respondido por ${d.respondido_por}</div>` : ''''}
          ${podeResponder ? `
            <div class="d-flex gap-2 flex-wrap">
              <button class="btn btn-sm ${d.status === ''tem'' ? ''btn-success'' : ''btn-outline-success''}"
                onclick="responderDemanda(${d.id}, ''tem'')">Tenho</button>
              <button class="btn btn-sm ${d.status === ''nao_tem'' ? ''btn-danger'' : ''btn-outline-danger''}"
                onclick="responderDemanda(${d.id}, ''nao_tem'')">Não tenho</button>
            </div>` : ''''}
          ${podeCriar ? `
            <button class="btn btn-sm btn-outline-secondary mt-2"
              onclick="excluirDemanda(${d.id})">Excluir</button>` : ''''}
        </div>
      </div>`
  }).join('''')
}

async function submeterFormulario(e) {
  e.preventDefault()

  const descricao = wrapperGlobal.querySelector(''#pc-descricao'').value.trim()
  if (!descricao) return

  const btnEnviar = wrapperGlobal.querySelector(''#pc-btn-enviar'')
  btnEnviar.disabled = true
  btnEnviar.textContent = ''Enviando...''

  const dados = {
    descricao,
    categoria: wrapperGlobal.querySelector(''#pc-categoria'').value,
    quantidade: wrapperGlobal.querySelector(''#pc-quantidade'').value || 0,
    unidade: wrapperGlobal.querySelector(''#pc-unidade'').value.trim() || null,
    pi_id: wrapperGlobal.querySelector(''#pc-pi'').value || null
  }

  const resultado = await api.demandas.criar(dados)
  btnEnviar.disabled = false
  btnEnviar.textContent = ''📨 Enviar pedido''

  if (resultado?.erro) {
    alert(resultado.erro || ''Erro ao enviar o pedido.'')
    return
  }

  e.target.reset()
  carregarLista()
}

window.responderDemanda = async function (id, status) {
  const resultado = await api.demandas.responder(id, status)
  if (resultado?.erro) {
    alert(resultado.erro || ''Erro ao responder.'')
    return
  }
  carregarLista()
}

window.excluirDemanda = async function (id) {
  if (!confirm(''Deseja excluir este pedido?'')) return
  await api.demandas.excluir(id)
  carregarLista()
}

export async function iniciarPedidosCompra(wrapper, opcoes) {
  if (!wrapper) return

  wrapperGlobal = wrapper
  podeCriar = !!(opcoes && opcoes.podeCriar)
  categoriasQuePodemResponder = (opcoes && opcoes.responderCategorias) || []

  wrapper.innerHTML = `
    ${podeCriar ? gerarFormulario() : ''''}
    <div id="lista-pedidos-compra"><p class="text-muted">Carregando...</p></div>`

  if (podeCriar) {
    await preencherSelectPis()
    const form = wrapper.querySelector(''#form-pedido-compra'')
    if (form) form.addEventListener(''submit'', submeterFormulario)
  }

  carregarLista()
}
