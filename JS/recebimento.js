import { api } from './api.js'
import { exigirPapel } from './auth.js'
import { montarCabecalho } from './cabecalho.js'

const labelPorTipo = { embalagem: 'Embalagem', rotulo: 'Rótulo', caixa: 'Caixa' }
const unidadePorTipo = { embalagem: 'kg', rotulo: 'kg', caixa: 'paletes' }

const containerCards = document.getElementById('cards-recebimento')
const mensagemVazio = document.getElementById('mensagem-vazio')

async function carregarPendentes() {
  const itens = await api.recebimentos.pendentes()
  if (!itens) return

  containerCards.innerHTML = ''
  mensagemVazio.innerHTML = ''

  if (itens.length === 0) {
    mensagemVazio.innerHTML = '<p class="vazio">Nenhum item pendente no momento. ✅</p>'
    return
  }

  itens.forEach((item) => {
    const unidade = unidadePorTipo[item.tipo] || 'unidades'
    const card = document.createElement('div')
    card.className = 'card-recebimento'

    const info = document.createElement('div')
    info.className = 'card-info'
    info.innerHTML = `
      <span class="pi-numero">PI ${item.numero_pi ?? ''}</span>
      <span class="cliente">${item.cliente ?? ''}</span>
      <span class="tipo-insumo">${labelPorTipo[item.tipo] ?? item.tipo}</span>
    `

    const campoQuantidade = document.createElement('label')
    campoQuantidade.className = 'campo-quantidade-recebimento'
    campoQuantidade.innerHTML = `
      <span>Quantidade recebida (${unidade})</span>
      <input type="number" class="input-quantidade" placeholder="ex: ${unidade === 'kg' ? '300' : '4'}" min="0" step="any">
    `

    const inputFoto = document.createElement('input')
    inputFoto.type = 'file'
    inputFoto.accept = 'image/*'
    inputFoto.capture = 'environment'
    inputFoto.hidden = true

    const botao = document.createElement('button')
    botao.className = 'btn-ok'
    botao.textContent = '📷 Registrar com foto'
    botao.addEventListener('click', () => {
      const quantidade = campoQuantidade.querySelector('.input-quantidade').value
      if (!quantidade) { alert(`Informe a quantidade recebida em ${unidade}.`); return }
      inputFoto.click()
    })

    inputFoto.addEventListener('change', () => {
      const arquivo = inputFoto.files[0]
      const quantidade = campoQuantidade.querySelector('.input-quantidade').value
      if (arquivo) registrar(item.id, quantidade, unidade, arquivo, botao)
    })

    card.appendChild(info)
    card.appendChild(campoQuantidade)
    card.appendChild(botao)
    card.appendChild(inputFoto)
    containerCards.appendChild(card)
  })
}

async function registrar(id, quantidade, unidade, arquivo, botao) {
  botao.disabled = true
  botao.textContent = 'Enviando...'
  const resultado = await api.recebimentos.registrar(id, `${quantidade} ${unidade}`, arquivo)
  if (resultado?.erro) {
    alert('Erro ao registrar. Tente novamente.')
    botao.disabled = false
    botao.textContent = '📷 Registrar com foto'
    return
  }
  carregarPendentes()
}

async function iniciar() {
  const perfil = exigirPapel(['admin', 'deposito'])
  if (!perfil) return
  montarCabecalho(perfil.papel)
  carregarPendentes()
}

iniciar()