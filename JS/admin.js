import { api } from './api.js'
import { calcularStatusProduto, formatarQuantidade } from './constants.js'
import { exigirPapel } from './auth.js'
import { montarCabecalho } from './cabecalho.js'

const containerPis = document.getElementById('container-pis')
const toggleConcluidas = document.getElementById('toggle-concluidas')

const rotuloInsumo = { embalagem: 'Embalagem', rotulo: 'Rótulo', caixa: 'Caixa', etiqueta: 'Etiqueta' }

function statusDoPi(pedido) {
  const produtos = pedido.produtos_pi || []
  if (produtos.length === 0) return 'SEM PRODUTOS'
  return produtos.some((p) => calcularStatusProduto(p.insumos_produto || []) === 'NÃO PRODUZ') ? 'NÃO PRODUZ' : 'LIBERADO'
}

function resumoRecebimento(pedido) {
  const r = pedido.recebimentos_b2 || []
  return `${r.filter((i) => i.status_recebimento === 'recebido').length}/${r.length}`
}

async function concluirPi(piId, concluida) {
  if (!confirm(`Deseja ${concluida ? 'reabrir' : 'concluir'} esta PI?`)) return
  await api.pedidos.concluir(piId, !concluida)
  carregar()
}

function renderizarAlmoxarifado(produtos) {
  if (!produtos || produtos.length === 0) {
    return '<p class="vazio-inline">Nenhum produto cadastrado.</p>'
  }
  return produtos.map((produto) => {
    const insumos = produto.insumos_produto || []
    const status = calcularStatusProduto(insumos)
    const linhas = insumos.map((insumo) => {
      let detalhes = ''
      if (insumo.tipo === 'caixa') {
        const sobra = Number(insumo.sobra) || 0
        const necessario = Number(produto.quantidade) || 0
        const suf = sobra >= necessario
        detalhes = `Sobra: ${sobra} cx · ${suf ? '<span class="texto-ok">Suficiente (+' + (sobra - necessario) + ' cx)</span>' : '<span class="texto-erro">Faltam ' + (necessario - sobra) + ' cx</span>'}`
      } else if (insumo.tipo === 'etiqueta') {
        const sobra = Number(insumo.sobra) || 0
        detalhes = sobra === 0 ? '<span class="texto-erro">Sem estoque</span>' : sobra < 100 ? '<span class="texto-alerta">⚠ Baixo (' + sobra + ' un)</span>' : sobra + ' unidades'
      } else {
        const sobra = Number(insumo.sobra) || 0
        const pacotes = Number(insumo.quantidade_por_pacote) || 0
        detalhes = 'Sobra: ' + sobra + ' kg' + (pacotes > 0 ? ' · ' + pacotes + ' pacotes' : '')
      }
      return '<tr><td>' + (rotuloInsumo[insumo.tipo] || insumo.tipo) + '</td><td>' + (insumo.confirmado ? '✅' : '❌') + '</td><td>' + detalhes + '</td></tr>'
    }).join('')
    return '<div class="bloco-produto"><div class="produto-cabecalho"><strong>' + produto.produto + '</strong><span class="qtd-produto">' + formatarQuantidade(produto.quantidade) + '</span><span class="badge ' + (status === 'LIBERADO' ? 'badge-ok' : 'badge-pendente') + '">' + status + '</span></div>' + (insumos.length > 0 ? '<table class="tabela-insumos-admin"><thead><tr><th>Insumo</th><th>OK</th><th>Estoque</th></tr></thead><tbody>' + linhas + '</tbody></table>' : '<p class="vazio-inline">Sem dados do almoxarifado.</p>') + '</div>'
  }).join('')
}

function renderizarRecebimentos(recebimentos) {
  const recebidos = (recebimentos || []).filter((r) => r.status_recebimento === 'recebido')
  if (recebidos.length === 0) return '<p class="vazio-inline">Nenhum recebimento confirmado ainda.</p>'
  return '<div class="grid-recebimentos-detalhe">' + recebidos.map((r) => {
    const fotos = (r.foto_url ? '<div class="foto-detalhe"><span class="foto-detalhe-label">Produto</span><img src="' + r.foto_url + '" class="foto-detalhe-img" loading="lazy"></div>' : '') + (r.foto_nota_url ? '<div class="foto-detalhe"><span class="foto-detalhe-label">Nota fiscal</span><img src="' + r.foto_nota_url + '" class="foto-detalhe-img" loading="lazy"></div>' : '') + (!r.foto_url && !r.foto_nota_url ? '<span class="vazio-inline">Sem fotos</span>' : '')
    return '<div class="card-recebimento-detalhe"><div class="recebimento-detalhe-info"><span class="badge badge-ok">' + (rotuloInsumo[r.tipo] || r.tipo) + '</span>' + (r.quantidade_recebida ? '<span class="recebimento-quantidade">' + r.quantidade_recebida + '</span>' : '') + '</div><div class="recebimento-fotos">' + fotos + '</div></div>'
  }).join('') + '</div>'
}

async function carregar() {
  const incluirConcluidas = toggleConcluidas.checked
  const pedidos = await api.pedidos.completo(incluirConcluidas)
  if (!pedidos) return

  const ativas = pedidos.filter((p) => !p.concluida).length
  const concluidas = pedidos.filter((p) => p.concluida).length

  document.getElementById('numero-liberados').textContent = pedidos.filter((p) => statusDoPi(p) === 'LIBERADO').length
  document.getElementById('numero-bloqueados').textContent = pedidos.filter((p) => statusDoPi(p) === 'NÃO PRODUZ').length
  document.getElementById('numero-total').textContent = ativas
  document.getElementById('numero-concluidas').textContent = concluidas

  containerPis.innerHTML = ''

  pedidos.forEach((pedido) => {
    const status = statusDoPi(pedido)
    const card = document.createElement('div')
    card.className = 'card-pi-admin' + (pedido.concluida ? ' pi-concluida' : '')

    const cabecalho = document.createElement('div')
    cabecalho.className = 'card-pi-cabecalho'
    cabecalho.innerHTML = '<div class="pi-cabecalho-info"><span class="pi-numero">PI ' + pedido.numero_pi + '</span><span class="pi-cliente">' + (pedido.cliente || '') + (pedido.destino ? ' · ' + pedido.destino : '') + '</span></div><div class="pi-cabecalho-acoes"><span class="badge ' + (status === 'LIBERADO' ? 'badge-ok' : status === 'NÃO PRODUZ' ? 'badge-pendente' : 'badge-em_andamento') + '">' + status + '</span><span class="recebimento-resumo">📦 ' + resumoRecebimento(pedido) + '</span><button class="btn-expandir" data-id="' + pedido.id + '">Ver detalhes ▾</button><button class="btn-concluir' + (pedido.concluida ? ' btn-reabrir' : '') + '" data-id="' + pedido.id + '" data-concluida="' + (pedido.concluida ? 'true' : 'false') + '">' + (pedido.concluida ? '↩ Reabrir' : '✔ Concluir') + '</button></div>'

    const detalhe = document.createElement('div')
    detalhe.className = 'card-pi-detalhe'
    detalhe.id = 'detalhe-' + pedido.id
    detalhe.style.display = 'none'
    detalhe.innerHTML = '<h4 class="detalhe-titulo">Insumos por Produto</h4>' + renderizarAlmoxarifado(pedido.produtos_pi) + '<h4 class="detalhe-titulo">Recebimentos B2</h4>' + renderizarRecebimentos(pedido.recebimentos_b2)

    card.appendChild(cabecalho)
    card.appendChild(detalhe)
    containerPis.appendChild(card)
  })

  document.querySelectorAll('.btn-expandir').forEach((btn) => {
    btn.addEventListener('click', () => {
      const detalhe = document.getElementById('detalhe-' + btn.dataset.id)
      const aberto = detalhe.style.display !== 'none'
      detalhe.style.display = aberto ? 'none' : 'block'
      btn.textContent = aberto ? 'Ver detalhes ▾' : 'Fechar ▴'
    })
  })

  document.querySelectorAll('.btn-concluir').forEach((btn) => {
    btn.addEventListener('click', () => {
      concluirPi(btn.dataset.id, btn.dataset.concluida === 'true')
    })
  })
}

toggleConcluidas.addEventListener('change', carregar)

async function iniciar() {
  const perfil = exigirPapel(['admin'])
  if (!perfil) return
  montarCabecalho(perfil.papel)
  carregar()
}

iniciar()