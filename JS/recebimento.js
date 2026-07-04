import { api } from './api.js'
import { exigirPapel } from './auth.js'
import { montarCabecalho } from './cabecalho.js'

const labelTipo = { embalagem: '📦 Embalagem', rotulo: '🏷️ Rótulo', caixa: '📫 Caixa' }
const unidadeTipo = { embalagem: 'kg', rotulo: 'kg', caixa: 'paletes' }

const containerCards = document.getElementById('cards-recebimento')
const mensagemVazio = document.getElementById('mensagem-vazio')

async function carregarPendentes() {
  const itens = await api.recebimentos.pendentes()
  if (!itens) return

  containerCards.innerHTML = ''
  mensagemVazio.innerHTML = ''

  if (itens.length === 0) {
    mensagemVazio.innerHTML = `
      <div class="text-center py-5">
        <div style="font-size:3rem">✅</div>
        <p class="fw-semibold mt-2 text-muted">Nenhum item pendente no momento.</p>
      </div>`
    return
  }

  itens.forEach((item) => {
    const unidade = unidadeTipo[item.tipo] || 'unidades'

    const card = document.createElement('div')
    card.className = 'card card-recebimento mb-3'

    const body = document.createElement('div')
    body.className = 'card-body p-3'

    const previewProduto = document.createElement('img')
    previewProduto.className = 'preview-foto'
    previewProduto.hidden = true

    const previewNota = document.createElement('img')
    previewNota.className = 'preview-foto'
    previewNota.hidden = true

    const inputFotoProduto = criarInputFoto()
    const inputFotoNota = criarInputFoto()

    const btnRemoverProduto = criarBtnRemover('✕ Remover foto do produto')
    btnRemoverProduto.hidden = true

    const btnRemoverNota = criarBtnRemover('✕ Remover foto da nota')
    btnRemoverNota.hidden = true

    const botaoProduto = document.createElement('button')
    botaoProduto.className = 'btn btn-outline-secondary btn-foto'
    botaoProduto.innerHTML = '📦 Foto do produto'
    botaoProduto.addEventListener('click', () => inputFotoProduto.click())

    const botaoNota = document.createElement('button')
    botaoNota.className = 'btn btn-outline-secondary btn-foto'
    botaoNota.innerHTML = '🧾 Foto da nota'
    botaoNota.addEventListener('click', () => inputFotoNota.click())

    inputFotoProduto.addEventListener('change', () => {
      const f = inputFotoProduto.files[0]
      if (!f) return
      previewProduto.src = URL.createObjectURL(f)
      previewProduto.hidden = false
      btnRemoverProduto.hidden = false
      botaoProduto.className = 'btn btn-foto btn-foto-ok'
      botaoProduto.innerHTML = '📦 Produto ✅'
    })

    inputFotoNota.addEventListener('change', () => {
      const f = inputFotoNota.files[0]
      if (!f) return
      previewNota.src = URL.createObjectURL(f)
      previewNota.hidden = false
      btnRemoverNota.hidden = false
      botaoNota.className = 'btn btn-foto btn-foto-ok'
      botaoNota.innerHTML = '🧾 Nota ✅'
    })

    btnRemoverProduto.addEventListener('click', () => {
      inputFotoProduto.value = ''
      previewProduto.hidden = true
      previewProduto.src = ''
      btnRemoverProduto.hidden = true
      botaoProduto.className = 'btn btn-outline-secondary btn-foto'
      botaoProduto.innerHTML = '📦 Foto do produto'
    })

    btnRemoverNota.addEventListener('click', () => {
      inputFotoNota.value = ''
      previewNota.hidden = true
      previewNota.src = ''
      btnRemoverNota.hidden = true
      botaoNota.className = 'btn btn-outline-secondary btn-foto'
      botaoNota.innerHTML = '🧾 Foto da nota'
    })

    const botaoRegistrar = document.createElement('button')
    botaoRegistrar.className = 'btn btn-ok-grande mt-2'
    botaoRegistrar.textContent = '✔ Confirmar recebimento'
    botaoRegistrar.addEventListener('click', () => {
      const quantidade = body.querySelector('.input-quantidade').value
      if (!quantidade) { alert(`Informe a quantidade em ${unidade}.`); return }
      registrar(item.id, quantidade, unidade, inputFotoProduto.files[0] || null, inputFotoNota.files[0] || null, botaoRegistrar)
    })

    body.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-1">
        <div class="d-flex align-items-center gap-1 flex-wrap">
          <span class="badge bg-danger">PI ${item.numero_pi ?? ''}</span>
          <span class="badge bg-secondary">${item.cliente ?? ''}</span>
        </div>
        <span class="badge bg-warning text-dark">${labelTipo[item.tipo] ?? item.tipo}</span>
      </div>
      ${item.produto ? `<div class="fw-semibold small mb-2">${item.produto}</div>` : ''}
      <div class="input-group input-group-sm mb-2">
        <span class="input-group-text">${unidade}</span>
        <input type="number" class="form-control input-quantidade" placeholder="0" min="0" step="any">
      </div>
    `

    const areaBotoes = document.createElement('div')
    areaBotoes.className = 'd-flex gap-2 mb-1'
    areaBotoes.appendChild(botaoProduto)
    areaBotoes.appendChild(botaoNota)

    body.appendChild(previewProduto)
    body.appendChild(btnRemoverProduto)
    body.appendChild(previewNota)
    body.appendChild(btnRemoverNota)
    body.appendChild(areaBotoes)
    body.appendChild(inputFotoProduto)
    body.appendChild(inputFotoNota)
    body.appendChild(botaoRegistrar)
    card.appendChild(body)
    containerCards.appendChild(card)
  })
}

function criarInputFoto() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.capture = 'environment'
  input.hidden = true
  return input
}

function criarBtnRemover(texto) {
  const btn = document.createElement('button')
  btn.className = 'btn-remover-foto d-block mb-1'
  btn.textContent = texto
  return btn
}

async function registrar(id, quantidade, unidade, fotoProduto, fotoNota, botao) {
  botao.disabled = true
  botao.textContent = 'Enviando...'
  const resultado = await api.recebimentos.registrar(id, `${quantidade} ${unidade}`, fotoProduto, fotoNota)
  if (resultado?.erro) {
    alert('Erro ao registrar. Tente novamente.')
    botao.disabled = false
    botao.textContent = '✔ Confirmar recebimento'
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