import { api } from './api.js'
import { TIPOS_INSUMO, formatarQuantidade } from './constants.js'
import { exigirPapel } from './auth.js'
import { montarCabecalho } from './cabecalho.js'

const selectPi = document.getElementById('select-pi')
const containerConteudo = document.getElementById('conteudo-pi')

function statusAutomatico(insumos, quantidade) {
  return TIPOS_INSUMO.every((tipo) => {
    if (tipo.chave === 'etiqueta') return true
    const insumo = insumos[tipo.chave]
    const sobra = Number(insumo?.sobra ?? 0)
    if (tipo.chave === 'caixa') return sobra >= Number(quantidade)
    return sobra > 0
  }) ? 'LIBERADO' : 'NÃO PRODUZ'
}

async function carregarPedidos() {
  const pedidos = await api.pedidos.listar()
  if (!pedidos) return
  pedidos.forEach((pedido) => {
    const opcao = document.createElement('option')
    opcao.value = pedido.id
    opcao.textContent = `PI ${pedido.numero_pi}${pedido.cliente ? ' — ' + pedido.cliente : ''}`
    selectPi.appendChild(opcao)
  })
}

async function carregarPi(piId) {
  containerConteudo.innerHTML = '<p class="loading">Carregando...</p>'
  if (!piId) {
    containerConteudo.innerHTML = ''
    return
  }

  const produtos = await api.produtos.listar(piId)
  if (!produtos || produtos.length === 0) {
    containerConteudo.innerHTML = '<p class="vazio">Nenhum produto cadastrado nesta PI.</p>'
    return
  }

  containerConteudo.innerHTML = ''

  for (const produto of produtos) {
    const { insumos: itensInsumo } = await api.produtos.insumos(produto.id)
    const insumos = {}
    TIPOS_INSUMO.forEach((tipo) => {
      const existente = (itensInsumo || []).find((i) => i.tipo === tipo.chave)
      insumos[tipo.chave] = existente || { tipo: tipo.chave, sobra: 0, quantidade_por_pacote: 0 }
    })

    const status = statusAutomatico(insumos, produto.quantidade)
    const bloco = document.createElement('div')
    bloco.className = 'bloco-produto-almox'
    bloco.dataset.produtoId = produto.id

    bloco.innerHTML = `
      <div class="produto-almox-cabecalho">
        <div class="produto-almox-info">
          <strong>${produto.produto}</strong>
          <span class="qtd-produto">${formatarQuantidade(produto.quantidade)}</span>
        </div>
        <span class="badge ${status === 'LIBERADO' ? 'badge-ok' : 'badge-pendente'}" data-status="${produto.id}">${status}</span>
      </div>

      <div class="grid-insumos-almox">
        ${TIPOS_INSUMO.map((tipo) => {
          const insumo = insumos[tipo.chave]
          let conteudoExtra = ''

          if (tipo.chave === 'caixa') {
            const sobra = Number(insumo.sobra) || 0
            const necessario = Number(produto.quantidade) || 0
            const suf = sobra >= necessario
            conteudoExtra = `<div class="saldo-valor ${suf ? 'saldo-positivo' : 'saldo-negativo'} resultado-caixa-${produto.id}">
              ${suf ? `Suficiente (sobram ${sobra - necessario} cx)` : `Faltam ${necessario - sobra} cx`}
            </div>`
          } else if (tipo.chave === 'etiqueta') {
            const sobra = Number(insumo.sobra) || 0
            const baixo = sobra > 0 && sobra < 100
            const sem = sobra === 0
            conteudoExtra = `<div class="saldo-valor ${sem ? 'saldo-negativo' : baixo ? 'saldo-alerta' : 'saldo-positivo'} resultado-etiqueta-${produto.id}">
              ${sem ? 'Sem estoque' : baixo ? `⚠ Estoque baixo (${sobra} un)` : `${sobra} unidades`}
            </div>`
          } else {
            const pacotes = Number(insumo.quantidade_por_pacote) || 0
            conteudoExtra = pacotes > 0 ? `<div class="saldo-valor saldo-positivo">${pacotes} pacotes possíveis</div>` : ''
          }

          const unidade = tipo.chave === 'caixa' ? 'cx' : tipo.chave === 'etiqueta' ? 'un' : 'kg'

          return `<div class="card-insumo-almox">
            <h4>${tipo.rotulo}</h4>
            <label class="linha-campo">
              ${tipo.chave === 'caixa' ? 'Sobra (cx)' : tipo.chave === 'etiqueta' ? 'Sobra (un)' : 'Sobra (kg)'}
              <input type="number"
                data-produto="${produto.id}"
                data-campo="sobra"
                data-tipo="${tipo.chave}"
                value="${insumo.sobra}"
                placeholder="0">
            </label>
            ${tipo.chave !== 'caixa' && tipo.chave !== 'etiqueta' ? `<label class="linha-campo">
              Pacotes possíveis
              <input type="number"
                data-produto="${produto.id}"
                data-campo="quantidade_por_pacote"
                data-tipo="${tipo.chave}"
                value="${insumo.quantidade_por_pacote}"
                placeholder="0">
            </label>` : ''}
            ${conteudoExtra}
          </div>`
        }).join('')}
      </div>

      <label class="linha-campo observacoes-item">
        Observações
        <textarea data-produto="${produto.id}" data-campo="observacoes" rows="2">${produto.observacoes || ''}</textarea>
      </label>

      <button class="btn-primary btn-salvar-produto" data-produto="${produto.id}" data-quantidade="${produto.quantidade}">
        Salvar ${produto.produto}
      </button>
    `

    containerConteudo.appendChild(bloco)
  }

  adicionarListeners(piId)
}

function adicionarListeners(piId) {
  containerConteudo.querySelectorAll('input[data-campo="sobra"]').forEach((input) => {
    input.addEventListener('input', () => atualizarResultado(input))
  })

  containerConteudo.querySelectorAll('.btn-salvar-produto').forEach((btn) => {
    btn.addEventListener('click', () => salvarProduto(btn.dataset.produto, btn.dataset.quantidade))
  })
}

function atualizarResultado(input) {
  const produtoId = input.dataset.produto
  const tipo = input.dataset.tipo
  const sobra = Number(input.value) || 0

  if (tipo === 'caixa') {
    const btn = containerConteudo.querySelector(`.btn-salvar-produto[data-produto="${produtoId}"]`)
    const necessario = Number(btn?.dataset.quantidade) || 0
    const suf = sobra >= necessario
    const el = containerConteudo.querySelector(`.resultado-caixa-${produtoId}`)
    if (el) {
      el.textContent = suf ? `Suficiente (sobram ${sobra - necessario} cx)` : `Faltam ${necessario - sobra} cx`
      el.className = `saldo-valor ${suf ? 'saldo-positivo' : 'saldo-negativo'} resultado-caixa-${produtoId}`
    }
  } else if (tipo === 'etiqueta') {
    const baixo = sobra > 0 && sobra < 100
    const sem = sobra === 0
    const el = containerConteudo.querySelector(`.resultado-etiqueta-${produtoId}`)
    if (el) {
      el.textContent = sem ? 'Sem estoque' : baixo ? `⚠ Estoque baixo (${sobra} un)` : `${sobra} unidades`
      el.className = `saldo-valor ${sem ? 'saldo-negativo' : baixo ? 'saldo-alerta' : 'saldo-positivo'} resultado-etiqueta-${produtoId}`
    }
  }

  atualizarBadgeStatus(produtoId)
}

function atualizarBadgeStatus(produtoId) {
  const btn = containerConteudo.querySelector(`.btn-salvar-produto[data-produto="${produtoId}"]`)
  const quantidade = Number(btn?.dataset.quantidade) || 0
  const insumosAtuais = {}
  TIPOS_INSUMO.forEach((tipo) => {
    const inputSobra = containerConteudo.querySelector(`input[data-produto="${produtoId}"][data-campo="sobra"][data-tipo="${tipo.chave}"]`)
    insumosAtuais[tipo.chave] = { sobra: inputSobra ? inputSobra.value : 0 }
  })
  const novoStatus = statusAutomatico(insumosAtuais, quantidade)
  const badge = containerConteudo.querySelector(`[data-status="${produtoId}"]`)
  if (badge) {
    badge.textContent = novoStatus
    badge.className = `badge ${novoStatus === 'LIBERADO' ? 'badge-ok' : 'badge-pendente'}`
  }
}

async function salvarProduto(produtoId, quantidade) {
  const insumosParaSalvar = TIPOS_INSUMO.map((tipo) => {
    const inputSobra = containerConteudo.querySelector(`input[data-produto="${produtoId}"][data-campo="sobra"][data-tipo="${tipo.chave}"]`)
    const inputPacotes = containerConteudo.querySelector(`input[data-produto="${produtoId}"][data-campo="quantidade_por_pacote"][data-tipo="${tipo.chave}"]`)
    return {
      tipo: tipo.chave,
      sobra: inputSobra ? inputSobra.value : 0,
      quantidade_por_pacote: inputPacotes ? inputPacotes.value : 0
    }
  })

  const textarea = containerConteudo.querySelector(`textarea[data-produto="${produtoId}"]`)

  const resultado = await api.produtos.salvarInsumos(produtoId, {
    insumos: insumosParaSalvar,
    observacoes: textarea ? textarea.value : '',
    quantidade
  })

  if (resultado?.erro) {
    alert('Erro ao salvar. Tente novamente.')
    return
  }

  const btn = containerConteudo.querySelector(`.btn-salvar-produto[data-produto="${produtoId}"]`)
  const textoOriginal = btn.textContent
  btn.textContent = '✔ Salvo!'
  btn.style.background = 'var(--green-ok)'
  setTimeout(() => {
    btn.textContent = textoOriginal
    btn.style.background = ''
  }, 2000)
}

selectPi.addEventListener('change', () => carregarPi(selectPi.value))

async function iniciar() {
  const perfil = exigirPapel(['admin', 'almoxarifado'])
  if (!perfil) return
  montarCabecalho(perfil.papel)
  carregarPedidos()
}

iniciar()