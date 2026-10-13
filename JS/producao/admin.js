import { api } from '/JS/core/api.js'
import { calcularStatusProduto, formatarQuantidade } from '/JS/core/constants.js'
import { exigirPapel } from '/JS/core/auth.js'
import { montarCabecalho } from '/JS/core/cabecalho.js'
import {
  piEmAlerta, bannerAlertaHtml, resumoAlertasHtml,
  piNaoDeclarada, bannerDeclaracaoHtml, resumoDeclaracaoHtml,
  seloPrazoDeclaracaoPiHtml, seloPrazoDeclaracaoHtml
} from '/JS/core/alertas.js'
import { filtroPaisAno, paisDe, anoDe } from '/JS/core/pais-ano.js'
import { abrirPainel, corpoPainel, painelAbertoId, fecharPainel } from '/JS/core/painel.js'

const containerPis   = document.getElementById('container-pis')
const toggleConcluidas = document.getElementById('toggle-concluidas')
let pedidosCache     = []


const ROTULO_INSUMO = {
  embalagem: 'Embalagem',
  rotulo: 'Rótulo',
  caixa: 'Caixa',
  etiqueta: 'Etiqueta'
}

function calcularStatusGeral(pedido) {
  const produtos = pedido.produtos_pi || []
  if (produtos.length === 0) return 'SEM PRODUTOS'
  return produtos.some((p) => calcularStatusProduto(p.insumos_produto || []) === 'NÃO PRODUZ')
    ? 'NÃO PRODUZ'
    : 'LIBERADO'
}

async function concluirPi(piId, jaConcluida, btn) {
  const acao = jaConcluida ? 'reabrir' : 'concluir'
  if (!confirm(`Deseja ${acao} esta PI?`)) return
  btn.disabled = true
  await api.pedidos.concluir(piId, !jaConcluida)
  carregar()
}



function gerarHtmlInsumosProduto(produtos) {
  if (!produtos || produtos.length === 0) {
    return '<p class="text-muted fst-italic small">Nenhum produto cadastrado.</p>'
  }

  return produtos.map((produto) => {
    const insumos = produto.insumos_produto || []
    const status = calcularStatusProduto(insumos)
    const liberado = status === 'LIBERADO'

    const linhasInsumos = insumos.map((insumo) => {
      let detalhe = ''

      if (insumo.tipo === 'caixa') {
        const sobra = Number(insumo.sobra) || 0
        const necessario = Number(produto.quantidade) || 0
        const suficiente = sobra >= necessario
        detalhe = `Sobra: ${sobra} cx · ${suficiente
          ? `<span class="texto-ok">✔ Suficiente (+${sobra - necessario} cx)</span>`
          : `<span class="texto-erro">✗ Faltam ${necessario - sobra} cx</span>`}`
      } else if (insumo.tipo === 'etiqueta') {
        const sobra = Number(insumo.sobra) || 0
        detalhe = sobra === 0
          ? '<span class="texto-erro">✗ Sem estoque</span>'
          : sobra < 100
            ? `<span class="texto-alerta">⚠ Baixo (${sobra} un)</span>`
            : `${sobra} unidades`
      } else {
        const sobra = Number(insumo.sobra) || 0
        const pacotes = Number(insumo.quantidade_por_pacote) || 0
        detalhe = `Sobra: ${sobra} kg${pacotes > 0 ? ` · ${pacotes} pacotes` : ''}`
      }

      const nomeInsumo = insumo.tipo === 'rotulo'
        ? ('Rótulo' + (insumo.nome ? ' – ' + insumo.nome : ''))
        : (ROTULO_INSUMO[insumo.tipo] || insumo.tipo)

      return `<tr>
        <td>${nomeInsumo}</td>
        <td>${insumo.confirmado ? '✔' : '✗'}</td>
        <td>${detalhe}</td>
      </tr>`
    }).join('')

    return `
      <div class="card border-0 bg-light rounded-3 p-3 mb-2">
        <div class="d-flex align-items-center gap-2 flex-wrap mb-2">
          <strong>${produto.produto}</strong>
          <span class="badge bg-secondary">${formatarQuantidade(produto.quantidade)}</span>
          <span class="badge ${liberado ? 'bg-success' : 'bg-danger'}">${status}</span>
          ${seloPrazoDeclaracaoHtml(produto)}
        </div>
        ${insumos.length > 0
          ? `<table class="table table-sm table-bordered mb-0 tabela-insumos-admin">
               <thead><tr><th>Insumo</th><th>OK</th><th>Estoque</th></tr></thead>
               <tbody>${linhasInsumos}</tbody>
             </table>`
          : '<p class="text-muted small mb-0 fst-italic">Sem dados do almoxarifado ainda.</p>'}
        ${produto.observacoes ? `<div class="small text-muted mt-2">${produto.observacoes}</div>` : ''}
      </div>`
  }).join('')
}

function gerarHtmlEntradasB2(entradas) {
  if (!entradas || entradas.length === 0) {
    return '<p class="text-muted fst-italic small">Nenhuma entrada registrada pelo depósito B2.</p>'
  }

  return entradas.map((e) => {
    const dataHora = new Date(e.criado_em).toLocaleString('pt-BR')
    return `
      <div class="border rounded-3 p-3 mb-2 bg-light">
        <div class="d-flex justify-content-between flex-wrap gap-1 mb-1">
          <span class="${e.produto ? 'fw-semibold small' : 'text-muted small fst-italic'}">
            ${e.produto || 'Produto não informado'}
          </span>
          <span class="small text-muted">${dataHora}</span>
        </div>
        ${e.localizacao ? `<div class="small mb-1"><span class="fw-semibold">${e.localizacao}</span></div>` : ''}
        <div class="d-flex gap-2 flex-wrap">
          ${e.embalagem_kg > 0 ? `<span class="badge bg-primary">${e.embalagem_kg} kg emb.</span>` : ''}
          ${e.rotulo_kg > 0 ? `<span class="badge bg-info text-dark">${e.rotulo_kg} kg rót.</span>` : ''}
          ${e.pallet_caixas > 0 ? `<span class="badge bg-secondary">${e.pallet_caixas} pallet(s)</span>` : ''}
        </div>
        ${e.foto_url || e.foto_nota_url ? `
          <div class="d-flex gap-2 mt-2 flex-wrap">
            ${e.foto_url ? `<a href="${e.foto_url}" target="_blank"><img src="${e.foto_url}" class="foto-detalhe-img rounded-2" alt="Foto produto"></a>` : ''}
            ${e.foto_nota_url ? `<a href="${e.foto_nota_url}" target="_blank"><img src="${e.foto_nota_url}" class="foto-detalhe-img rounded-2" alt="Foto nota"></a>` : ''}
          </div>` : ''}
      </div>`
  }).join('')
}

function gerarHtmlVinculosEstoque(vinculos) {
  if (!vinculos || vinculos.length === 0) {
    return '<p class="text-muted fst-italic small">Nenhum insumo do estoque geral vinculado a esta PI.</p>'
  }

  return vinculos.map((v) => {
    const dataEntrada = new Date(v.entrada_data).toLocaleString('pt-BR')
    const dataVinculo = new Date(v.criado_em).toLocaleString('pt-BR')

    return `
      <div class="border rounded-3 p-3 mb-2 bg-light">
        <div class="d-flex justify-content-between flex-wrap gap-1 mb-1">
          ${v.produto_entrada
            ? `<span class="fw-semibold small">${v.produto_entrada}</span>`
            : '<span class="text-muted small">Produto não informado</span>'}
          <span class="small text-muted">Vinculado em ${dataVinculo}</span>
        </div>
        <div class="d-flex gap-2 flex-wrap mb-1">
          ${v.embalagem_kg > 0 ? `<span class="badge bg-primary">${v.embalagem_kg} kg emb.</span>` : ''}
          ${v.rotulo_kg > 0 ? `<span class="badge bg-info text-dark">${v.rotulo_kg} kg rót.</span>` : ''}
          ${v.pallet_caixas > 0 ? `<span class="badge bg-secondary">${v.pallet_caixas} pallet(s)</span>` : ''}
        </div>
        ${v.entrada_localizacao ? `<div class="small mb-1"><span class="fw-semibold">${v.entrada_localizacao}</span></div>` : ''}
        <div class="small text-muted">Entrada no B2: ${dataEntrada}</div>
        ${v.entrada_foto || v.entrada_foto_nota ? `
          <div class="d-flex gap-2 mt-2 flex-wrap">
            ${v.entrada_foto ? `<a href="${v.entrada_foto}" target="_blank"><img src="${v.entrada_foto}" class="foto-detalhe-img rounded-2" alt="Foto produto"></a>` : ''}
            ${v.entrada_foto_nota ? `<a href="${v.entrada_foto_nota}" target="_blank"><img src="${v.entrada_foto_nota}" class="foto-detalhe-img rounded-2" alt="Foto nota"></a>` : ''}
          </div>` : ''}
      </div>`
  }).join('')
}

function gerarHtmlRecebimentosB2(recebimentos) {
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

      return `
        <div class="d-flex align-items-start gap-2 flex-wrap mb-1">
          <span class="badge ${recebido ? 'bg-success' : 'bg-danger'}" style="min-width:90px;text-align:center">
            ${ROTULO_INSUMO[r.tipo] || r.tipo}
          </span>
          ${recebido && r.quantidade_recebida ? `<span class="badge bg-light text-dark border">${r.quantidade_recebida}</span>` : ''}
          ${!recebido ? '<span class="text-muted small">Pendente</span>' : ''}
          ${fotos ? `<div class="d-flex">${fotos}</div>` : ''}
        </div>`
    }).join('')

    return `
      <div class="mb-2">
        <div class="small fw-bold text-secondary mb-1">• ${nomeProduto}</div>
        <div class="ps-2">${linhas}</div>
      </div>`
  }).join('<hr class="my-2">')
}

const dataBR = (v) => v ? new Date(String(v).slice(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR') : ''

function resumoPedido(pedido) {
  const status = calcularStatusGeral(pedido)
  const totalRecebimentos = (pedido.recebimentos_b2 || []).length
  const qtdRecebidos = (pedido.recebimentos_b2 || []).filter((r) => r.status_recebimento === 'recebido').length
  return {
    status,
    liberado: status === 'LIBERADO',
    naoProducao: status === 'NÃO PRODUZ',
    totalRecebimentos,
    qtdRecebidos,
    qtdVinculos: (pedido.vinculos_estoque || []).length,
    emAlerta: piEmAlerta(pedido),
    naoDeclarada: piNaoDeclarada(pedido)
  }
}

function seloStatus(r) {
  return `<span class="badge ${r.liberado ? 'bg-success' : r.naoProducao ? 'bg-danger' : 'bg-secondary'}">${r.status}</span>`
}

function construirLinha(pedido) {
  const r = resumoPedido(pedido)
  const linha = document.createElement('button')
  linha.type = 'button'
  linha.className = [
    'pi-linha',
    pedido.concluida ? 'pi-linha-concluida' : '',
    (!pedido.concluida && r.liberado) ? 'pi-linha-ok' : '',
    r.emAlerta ? 'pi-linha-alerta' : '',
    r.naoDeclarada ? 'pi-linha-declaracao' : ''
  ].filter(Boolean).join(' ')
  linha.dataset.id = pedido.id
  linha.dataset.pais = paisDe(pedido.destino)
  linha.dataset.ano = anoDe(pedido.data_cadastro)
  linha.innerHTML = `
    <span class="pi-linha-num">PI ${pedido.numero_pi}</span>
    <span class="pi-linha-info">
      <span class="pi-linha-cliente">${pedido.cliente || '—'}</span>
      <span class="pi-linha-meta">${paisDe(pedido.destino)}${pedido.data_embarque ? ' · Embarque ' + dataBR(pedido.data_embarque) : ' · Sem data de embarque'}</span>
    </span>
    <span class="pi-linha-selos">
      ${r.emAlerta ? '<span class="badge bg-danger">Embarque próximo</span>' : ''}
      ${r.naoDeclarada ? '<span class="badge bg-warning text-dark">Declaração pendente</span>' : ''}
      ${r.totalRecebimentos > 0 ? `<span class="pi-linha-mini">B2 ${r.qtdRecebidos}/${r.totalRecebimentos}</span>` : ''}
      ${seloStatus(r)}
    </span>
    <span class="pi-linha-seta" aria-hidden="true">›</span>`
  return linha
}

function construirDetalhe(pedido) {
  const r = resumoPedido(pedido)
  const detalhe = document.createElement('div')

  if (r.emAlerta) detalhe.insertAdjacentHTML('beforeend', bannerAlertaHtml(pedido))
  if (r.naoDeclarada) detalhe.insertAdjacentHTML('beforeend', bannerDeclaracaoHtml(pedido))

  const info = document.createElement('div')
  info.className = 'painel-info'
  info.innerHTML = `
    <div><span>Cliente</span><strong>${pedido.cliente || '—'}</strong></div>
    <div><span>Destino</span><strong>${paisDe(pedido.destino)}</strong></div>
    <div><span>Cadastro</span><strong>${dataBR(pedido.data_cadastro) || '—'}</strong></div>
    <div><span>Embarque</span><strong>${dataBR(pedido.data_embarque) || '—'}</strong></div>
    <div><span>Recebimentos B2</span><strong>${r.qtdRecebidos}/${r.totalRecebimentos}</strong></div>
    <div><span>Vínculos de estoque</span><strong>${r.qtdVinculos}</strong></div>`
  detalhe.appendChild(info)

  const secaoAlmox = document.createElement('div')
  secaoAlmox.className = 'mt-3'
  secaoAlmox.innerHTML = `
    <div class="secao-titulo-card mb-2">Insumos por Produto (Almoxarifado)</div>
    ${gerarHtmlInsumosProduto(pedido.produtos_pi)}`

  const secaoEstoque = document.createElement('div')
  secaoEstoque.className = 'mt-3'
  secaoEstoque.innerHTML = `
    <div class="secao-titulo-card mb-2">Estoque Geral Vinculado</div>
    ${gerarHtmlVinculosEstoque(pedido.vinculos_estoque)}`

  const secaoB2 = document.createElement('div')
  secaoB2.className = 'mt-3'
  secaoB2.innerHTML = `
    <div class="secao-titulo-card mb-2">Recebimentos B2 por PI</div>
    ${gerarHtmlRecebimentosB2(pedido.recebimentos_b2)}`

  if (!window._somente_leitura) {
    const secaoComentario = document.createElement('div')
    secaoComentario.className = 'mt-3'
    secaoComentario.innerHTML = `
      <div class="secao-titulo-card mb-2">Cobrar data de embarque</div>
      <div class="input-group input-group-sm">
        <input type="text" class="form-control campo-cobranca-embarque" data-id="${pedido.id}"
          placeholder="Ex.: Favor informar a data de embarque desta PI"
          value="${(pedido.comentario_embarque || '').replace(/"/g, '&quot;')}">
        <button class="btn btn-outline-primary" onclick="salvarCobrancaEmbarque(${pedido.id})">Enviar</button>
      </div>
      ${pedido.comentario_embarque ? `
        <div class="alert alert-primary mt-2 mb-0 py-2 small">
          <strong>Comentário de:</strong> ${pedido.comentario_usuario || 'Admin'}<br>
          ${pedido.comentario_embarque}
        </div>` : ''}`
    detalhe.appendChild(secaoComentario)
  }

  detalhe.appendChild(secaoAlmox)
  detalhe.appendChild(secaoEstoque)
  detalhe.appendChild(secaoB2)
  return detalhe
}

function abrirDetalhe(id) {
  const pedido = pedidosCache.find((p) => String(p.id) === String(id))
  if (!pedido) return
  const r = resumoPedido(pedido)
  abrirPainel({
    id: pedido.id,
    titulo: `PI ${pedido.numero_pi}`,
    subtitulo: `${pedido.cliente || ''}${pedido.destino ? ' · ' + paisDe(pedido.destino) : ''}`,
    selos: `${seloStatus(r)} ${seloPrazoDeclaracaoPiHtml(pedido)}`,
    conteudo: construirDetalhe(pedido),
    rodape: window._somente_leitura ? '' : `
      <button class="btn btn-sm ${pedido.concluida ? 'btn-outline-warning' : 'btn-outline-success'} btn-concluir"
        data-id="${pedido.id}" data-concluida="${pedido.concluida ? 'true' : 'false'}">
        ${pedido.concluida ? 'Reabrir PI' : 'Concluir PI'}
      </button>`
  })
}

window.salvarCobrancaEmbarque = async function (id) {
  const input = document.querySelector(`.campo-cobranca-embarque[data-id="${id}"]`)
  if (!input) return

  const btn = input.nextElementSibling
  const texto = input.value.trim()
  const textoOriginal = btn.textContent

  btn.disabled = true
  btn.textContent = '...'

  const resultado = await api.pedidos.comentarioEmbarque(id, texto)

  btn.disabled = false

  if (resultado?.erro) {
    btn.textContent = textoOriginal
    alert('Erro ao enviar o comentário.')
    return
  }

  btn.textContent = 'Enviado'
  setTimeout(() => { btn.textContent = textoOriginal }, 2000)
}



function renderizarPis(pedidos) {
  containerPis.innerHTML = ''

  const alertaEmbarque = resumoAlertasHtml(pedidos)
  if (alertaEmbarque) containerPis.insertAdjacentHTML('beforeend', alertaEmbarque)
  const alertaDeclaracao = resumoDeclaracaoHtml(pedidos)
  if (alertaDeclaracao) containerPis.insertAdjacentHTML('beforeend', alertaDeclaracao)

  if (!pedidos.length) {
    const vazio = document.createElement('p')
    vazio.className = 'text-muted fst-italic'; vazio.textContent = 'Nenhuma PI cadastrada.'
    containerPis.appendChild(vazio); return
  }

  const ordenados = [...pedidos].sort((a, b) =>
    paisDe(a.destino).localeCompare(paisDe(b.destino), 'pt-BR') ||
    String(b.data_cadastro || '').localeCompare(String(a.data_cadastro || '')))

  const lista = document.createElement('div')
  lista.className = 'pi-lista'
  ordenados.forEach((p) => lista.appendChild(construirLinha(p)))
  containerPis.appendChild(lista)
  filtroPaisAno(lista, { chave: 'visao-geral' })
}

async function carregar() {
  const incluirConcluidas = toggleConcluidas.checked
  containerPis.innerHTML = '<p class="text-muted">Carregando...</p>'

  const pedidos = await api.pedidos.completo(incluirConcluidas)
  if (!pedidos) {
    containerPis.innerHTML = '<p class="text-danger">Não foi possível carregar. Verifique a conexão.</p>'
    return
  }

  const ativas = pedidos.filter((p) => !p.concluida).length
  const concluidas = pedidos.filter((p) => p.concluida).length
  document.getElementById('numero-liberados').textContent = pedidos.filter((p) => calcularStatusGeral(p) === 'LIBERADO' && !p.concluida).length
  document.getElementById('numero-bloqueados').textContent = pedidos.filter((p) => calcularStatusGeral(p) === 'NÃO PRODUZ' && !p.concluida).length
  document.getElementById('numero-total').textContent = ativas
  document.getElementById('numero-concluidas').textContent = concluidas

  pedidosCache = pedidos

  const entradas = await api.estoque.historico()
  containerPis.innerHTML = ''
  if (entradas && entradas.length) {
    const cardEntradas = document.createElement('div')
    cardEntradas.className = 'card border-0 shadow-sm mb-4'
    cardEntradas.innerHTML = `<div class="card-body"><div class="secao-titulo-card mb-3">Entradas no Depósito B2</div>${gerarHtmlEntradasB2(entradas)}</div>`
    containerPis.appendChild(cardEntradas)
  }

  renderizarPis(pedidos)
  atualizarPainel()
}

function atualizarPainel() {
  const id = painelAbertoId()
  if (!id) return
  const foco = document.activeElement
  if (foco && corpoPainel().contains(foco) && /INPUT|TEXTAREA|SELECT/.test(foco.tagName)) return
  if (pedidosCache.some((p) => String(p.id) === id)) abrirDetalhe(id)
  else fecharPainel()
}

containerPis.addEventListener('click', (e) => {
  const linha = e.target.closest('.pi-linha')
  if (linha) abrirDetalhe(linha.dataset.id)
})

corpoPainel().addEventListener('click', (e) => {
  const btnConcluir = e.target.closest('.btn-concluir')
  if (btnConcluir) concluirPi(btnConcluir.dataset.id, btnConcluir.dataset.concluida === 'true', btnConcluir)
})

toggleConcluidas.addEventListener('change', carregar)
setInterval(carregar, 5 * 60 * 1000)
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') carregar() })

async function iniciar() {
  const perfil = exigirPapel('todos')
  if (!perfil) return
  montarCabecalho(perfil.papel)
  window._somente_leitura = perfil.papel !== 'admin'
  carregar()
}

iniciar()