import { api } from './api.js'
import { TIPOS_INSUMO, formatarQuantidade } from './constants.js'
import { exigirPapel } from './auth.js'
import { montarCabecalho } from './cabecalho.js'

const selectPi = document.getElementById('select-pi')
const selectProduto = document.getElementById('select-produto')
const formularioContainer = document.getElementById('formulario-container')

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

async function carregarProdutos(piId) {
  selectProduto.innerHTML = '<option value="">Selecione o produto</option>'
  formularioContainer.innerHTML = ''
  if (!piId) { selectProduto.disabled = true; return }
  selectProduto.disabled = false
  const produtos = await api.produtos.listar(piId)
  if (!produtos) return
  produtos.forEach((produto) => {
    const opcao = document.createElement('option')
    opcao.value = produto.id
    opcao.textContent = `${produto.produto} (${formatarQuantidade(produto.quantidade)})`
    selectProduto.appendChild(opcao)
  })
}

async function carregarFormulario(produtoId) {
  formularioContainer.innerHTML = ''
  if (!produtoId) return
  const { produto: produtoInfo, insumos: itensInsumo } = await api.produtos.insumos(produtoId)
  const insumos = {}
  TIPOS_INSUMO.forEach((tipo) => {
    const existente = itensInsumo.find((i) => i.tipo === tipo.chave)
    insumos[tipo.chave] = existente || { tipo: tipo.chave, sobra: 0, quantidade_por_pacote: 0 }
  })
  renderizarFormulario(produtoInfo, insumos)
}

function statusAutomatico(insumos, quantidade) {
  return TIPOS_INSUMO.every((tipo) => {
    if (tipo.chave === 'etiqueta') return true
    const insumo = insumos[tipo.chave]
    const sobra = Number(insumo?.sobra ?? 0)
    if (tipo.chave === 'caixa') return sobra >= Number(quantidade)
    return sobra > 0
  }) ? 'LIBERADO' : 'NÃO PRODUZ'
}

function renderizarFormulario(produtoInfo, insumos) {
  const form = document.createElement('form')
  form.className = 'formulario-item'

  const statusAtual = statusAutomatico(insumos, produtoInfo.quantidade)
  const badgeStatus = document.createElement('span')
  badgeStatus.id = 'badge-status'
  badgeStatus.className = `badge ${statusAtual === 'LIBERADO' ? 'badge-ok' : 'badge-pendente'}`
  badgeStatus.textContent = statusAtual

  const cabecalhoItem = document.createElement('div')
  cabecalhoItem.className = 'cabecalho-item'
  cabecalhoItem.innerHTML = `<h2>${produtoInfo.produto}</h2><span>Quantidade: ${formatarQuantidade(produtoInfo.quantidade)}</span>`
  cabecalhoItem.appendChild(badgeStatus)
  form.appendChild(cabecalhoItem)

  const gridInsumos = document.createElement('div')
  gridInsumos.className = 'grid-insumos'

  TIPOS_INSUMO.forEach((tipo) => {
    const insumo = insumos[tipo.chave]
    const card = document.createElement('div')
    card.className = 'card-insumo'

    if (tipo.chave === 'caixa') {
      const sobra = Number(insumo.sobra) || 0
      const necessario = Number(produtoInfo.quantidade) || 0
      const suficiente = sobra >= necessario
      card.innerHTML = `
        <h3>${tipo.rotulo}</h3>
        <label class="linha-campo">Sobra em estoque (cx)<input type="number" data-campo="sobra" data-tipo="caixa" value="${sobra}" placeholder="ex: 800"></label>
        <div class="saldo-valor ${suficiente ? 'saldo-positivo' : 'saldo-negativo'} resultado-caixa">
          ${suficiente ? `Suficiente (sobram ${sobra - necessario} cx)` : `Faltam ${necessario - sobra} cx`}
        </div>`
      gridInsumos.appendChild(card)
      const inputSobra = card.querySelector('[data-campo="sobra"][data-tipo="caixa"]')
      const resultadoEl = card.querySelector('.resultado-caixa')
      inputSobra.addEventListener('input', () => {
        const s = Number(inputSobra.value) || 0
        const suf = s >= necessario
        resultadoEl.textContent = suf ? `Suficiente (sobram ${s - necessario} cx)` : `Faltam ${necessario - s} cx`
        resultadoEl.className = `saldo-valor ${suf ? 'saldo-positivo' : 'saldo-negativo'} resultado-caixa`
        atualizarStatusGeral()
      })
    } else if (tipo.chave === 'etiqueta') {
      const sobra = Number(insumo.sobra) || 0
      const baixo = sobra > 0 && sobra < 100
      const sem = sobra === 0
      card.innerHTML = `
        <h3>${tipo.rotulo}</h3>
        <label class="linha-campo">Sobra em estoque (unidades)<input type="number" data-campo="sobra" data-tipo="etiqueta" value="${sobra}" placeholder="ex: 500"></label>
        <div class="saldo-valor ${sem ? 'saldo-negativo' : baixo ? 'saldo-alerta' : 'saldo-positivo'} resultado-etiqueta">
          ${sem ? 'Sem estoque' : baixo ? `⚠ Estoque baixo (${sobra} un)` : `${sobra} unidades`}
        </div>`
      gridInsumos.appendChild(card)
      const inputEtiqueta = card.querySelector('[data-campo="sobra"][data-tipo="etiqueta"]')
      const resultadoEtiqueta = card.querySelector('.resultado-etiqueta')
      inputEtiqueta.addEventListener('input', () => {
        const s = Number(inputEtiqueta.value) || 0
        const b = s > 0 && s < 100
        const sm = s === 0
        resultadoEtiqueta.textContent = sm ? 'Sem estoque' : b ? `⚠ Estoque baixo (${s} un)` : `${s} unidades`
        resultadoEtiqueta.className = `saldo-valor ${sm ? 'saldo-negativo' : b ? 'saldo-alerta' : 'saldo-positivo'} resultado-etiqueta`
      })
    } else {
      card.innerHTML = `
        <h3>${tipo.rotulo}</h3>
        <label class="linha-campo">Sobra em estoque (kg)<input type="number" data-campo="sobra" data-tipo="${tipo.chave}" value="${insumo.sobra}" placeholder="ex: 300"></label>
        <label class="linha-campo">Pacotes possíveis com essa sobra<input type="number" data-campo="quantidade_por_pacote" data-tipo="${tipo.chave}" value="${insumo.quantidade_por_pacote}" placeholder="ex: 600"></label>`
      gridInsumos.appendChild(card)
      card.querySelector(`[data-campo="sobra"][data-tipo="${tipo.chave}"]`).addEventListener('input', atualizarStatusGeral)
    }
  })

  form.appendChild(gridInsumos)

  function atualizarStatusGeral() {
    const insumosAtuais = {}
    TIPOS_INSUMO.forEach((tipo) => {
      const inputSobra = form.querySelector(`[data-campo="sobra"][data-tipo="${tipo.chave}"]`)
      insumosAtuais[tipo.chave] = { sobra: inputSobra ? inputSobra.value : 0 }
    })
    const novoStatus = statusAutomatico(insumosAtuais, produtoInfo.quantidade)
    const badge = form.querySelector('#badge-status')
    badge.textContent = novoStatus
    badge.className = `badge ${novoStatus === 'LIBERADO' ? 'badge-ok' : 'badge-pendente'}`
  }

  const campoObservacoes = document.createElement('label')
  campoObservacoes.className = 'linha-campo observacoes-item'
  campoObservacoes.innerHTML = `Observações<textarea id="campo-observacoes" rows="3">${produtoInfo.observacoes ?? ''}</textarea>`
  form.appendChild(campoObservacoes)

  const botaoSalvar = document.createElement('button')
  botaoSalvar.type = 'submit'
  botaoSalvar.className = 'btn-primary'
  botaoSalvar.textContent = 'Salvar informações'
  form.appendChild(botaoSalvar)

  formularioContainer.appendChild(form)

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault()
    const insumosParaSalvar = TIPOS_INSUMO.map((tipo) => {
      const inputSobra = form.querySelector(`[data-campo="sobra"][data-tipo="${tipo.chave}"]`)
      const inputPacotes = form.querySelector(`[data-campo="quantidade_por_pacote"][data-tipo="${tipo.chave}"]`)
      return {
        tipo: tipo.chave,
        sobra: inputSobra ? inputSobra.value : 0,
        quantidade_por_pacote: inputPacotes ? inputPacotes.value : 0
      }
    })
    await api.produtos.salvarInsumos(produtoInfo.id, {
      insumos: insumosParaSalvar,
      observacoes: document.getElementById('campo-observacoes').value,
      quantidade: produtoInfo.quantidade
    })
    alert('Informações salvas.')
    carregarFormulario(produtoInfo.id)
  })
}

selectPi.addEventListener('change', () => carregarProdutos(selectPi.value))
selectProduto.addEventListener('change', () => carregarFormulario(selectProduto.value))

async function iniciar() {
  const perfil = exigirPapel(['admin', 'almoxarifado'])
  if (!perfil) return
  montarCabecalho(perfil.papel)
  carregarPedidos()
}

iniciar()