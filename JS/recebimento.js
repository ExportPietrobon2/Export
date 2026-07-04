import { api } from './api.js'
import { exigirPapel } from './auth.js'
import { montarCabecalho } from './cabecalho.js'

const labelTipo = { embalagem: 'Embalagem', rotulo: 'Rótulo', caixa: 'Caixa' }
const unidadeTipo = { embalagem: 'kg', rotulo: 'kg', caixa: 'paletes' }

const containerCards = document.getElementById('cards-recebimento')
const mensagemVazio = document.getElementById('mensagem-vazio')

async function carregarRecebimentos() {
  const pis = await api.recebimentos.pendentes()
  if (!pis) return

  containerCards.innerHTML = ''
  mensagemVazio.innerHTML = ''

  const todas = pis.flatMap((pi) => pi.insumos)
  if (todas.every((i) => i.status === 'recebido')) {
    mensagemVazio.innerHTML = `
      <div class="text-center py-5">
        <div style="font-size:3rem">✅</div>
        <p class="fw-semibold mt-2 text-muted">Tudo recebido por hoje.</p>
      </div>`
    return
  }

  pis.forEach((pi) => {
    const card = document.createElement('div')
    card.className = 'card card-recebimento mb-3'

    const cabecalho = document.createElement('div')
    cabecalho.className = 'card-body pb-2'
    cabecalho.innerHTML = `
      <div class="d-flex align-items-center gap-1 flex-wrap mb-2">
        <span class="badge bg-danger">PI ${pi.numero_pi}</span>
        <span class="badge bg-secondary">${pi.cliente ?? ''}</span>
      </div>
      ${pi.produtos.length > 0 ? `
        <div class="small text-muted mb-1">Produtos:</div>
        <ul class="list-unstyled mb-0 small fw-semibold">
          ${pi.produtos.map((p) => `<li>• ${p}</li>`).join('')}
        </ul>` : ''}
    `

    const botoes = document.createElement('div')
    botoes.className = 'd-flex gap-2 flex-wrap px-3 pb-3 mt-2'

    pi.insumos.forEach((insumo) => {
      const recebido = insumo.status_recebimento === 'recebido'
      const btn = document.createElement('button')
      btn.className = `btn btn-sm ${recebido ? 'btn-success' : 'btn-outline-danger'}`
      btn.style.borderRadius = '20px'
      btn.innerHTML = `${recebido ? '✔' : '○'} ${labelTipo[insumo.tipo] ?? insumo.tipo}${recebido && insumo.quantidade_recebida ? ' · ' + insumo.quantidade_recebida : ''}`

      if (!recebido) {
        btn.addEventListener('click', () => abrirFormulario(insumo, pi, btn, botoes))
      }

      botoes.appendChild(btn)
    })

    card.appendChild(cabecalho)
    card.appendChild(botoes)
    containerCards.appendChild(card)
  })
}

function abrirFormulario(insumo, pi, btn, botoes) {
  const idForm = `form-insumo-${insumo.id}`
  const existente = document.getElementById(idForm)
  if (existente) {
    existente.remove()
    btn.classList.remove('active')
    return
  }

  document.querySelectorAll('.form-insumo-expansivel').forEach((f) => f.remove())
  document.querySelectorAll('.btn-insumo-ativo').forEach((b) => b.classList.remove('btn-insumo-ativo', 'active'))

  btn.classList.add('active')

  const unidade = unidadeTipo[insumo.tipo] || 'unidades'

  const form = document.createElement('div')
  form.id = idForm
  form.className = 'form-insumo-expansivel px-3 pb-3 border-top pt-3'

  const previewProduto = document.createElement('img')
  previewProduto.className = 'preview-foto'
  previewProduto.hidden = true

  const previewNota = document.createElement('img')
  previewNota.className = 'preview-foto'
  previewNota.hidden = true

  const inputFotoProduto = criarInputFoto()
  const inputFotoNota = criarInputFoto()

  const btnProduto = document.createElement('button')
  btnProduto.className = 'btn btn-sm btn-outline-secondary btn-foto'
  btnProduto.innerHTML = '📦 Foto produto'
  btnProduto.addEventListener('click', () => inputFotoProduto.click())

  const btnNota = document.createElement('button')
  btnNota.className = 'btn btn-sm btn-outline-secondary btn-foto'
  btnNota.innerHTML = '🧾 Foto nota'
  btnNota.addEventListener('click', () => inputFotoNota.click())

  const btnRemoverProduto = criarBtnRemover('✕ produto')
  btnRemoverProduto.hidden = true

  const btnRemoverNota = criarBtnRemover('✕ nota')
  btnRemoverNota.hidden = true

  inputFotoProduto.addEventListener('change', () => {
    const f = inputFotoProduto.files[0]
    if (!f) return
    previewProduto.src = URL.createObjectURL(f)
    previewProduto.hidden = false
    btnRemoverProduto.hidden = false
    btnProduto.className = 'btn btn-sm btn-foto btn-foto-ok'
    btnProduto.innerHTML = '📦 ✅'
  })

  inputFotoNota.addEventListener('change', () => {
    const f = inputFotoNota.files[0]
    if (!f) return
    previewNota.src = URL.createObjectURL(f)
    previewNota.hidden = false
    btnRemoverNota.hidden = false
    btnNota.className = 'btn btn-sm btn-foto btn-foto-ok'
    btnNota.innerHTML = '🧾 ✅'
  })

  btnRemoverProduto.addEventListener('click', () => {
    inputFotoProduto.value = ''
    previewProduto.hidden = true
    previewProduto.src = ''
    btnRemoverProduto.hidden = true
    btnProduto.className = 'btn btn-sm btn-outline-secondary btn-foto'
    btnProduto.innerHTML = '📦 Foto produto'
  })

  btnRemoverNota.addEventListener('click', () => {
    inputFotoNota.value = ''
    previewNota.hidden = true
    previewNota.src = ''
    btnRemoverNota.hidden = true
    btnNota.className = 'btn btn-sm btn-outline-secondary btn-foto'
    btnNota.innerHTML = '🧾 Foto nota'
  })

  const inputQtd = document.createElement('input')
  inputQtd.type = 'number'
  inputQtd.className = 'form-control form-control-sm'
  inputQtd.placeholder = `Qtd em ${unidade}`
  inputQtd.min = '0'
  inputQtd.step = 'any'

  const btnConfirmar = document.createElement('button')
  btnConfirmar.className = 'btn btn-ok-grande mt-2'
  btnConfirmar.textContent = `✔ Confirmar ${labelTipo[insumo.tipo]}`
  btnConfirmar.addEventListener('click', () => {
    if (!inputQtd.value) { alert(`Informe a quantidade em ${unidade}.`); return }
    registrar(insumo.id, inputQtd.value, unidade, inputFotoProduto.files[0] || null, inputFotoNota.files[0] || null, btnConfirmar)
  })

  const areaBotoesFoto = document.createElement('div')
  areaBotoesFoto.className = 'd-flex gap-2 mb-2 mt-2'
  areaBotoesFoto.appendChild(btnProduto)
  areaBotoesFoto.appendChild(btnNota)

  const areaBtnRemover = document.createElement('div')
  areaBtnRemover.className = 'd-flex gap-3 mb-2'
  areaBtnRemover.appendChild(btnRemoverProduto)
  areaBtnRemover.appendChild(btnRemoverNota)

  form.appendChild(inputQtd)
  form.appendChild(previewProduto)
  form.appendChild(previewNota)
  form.appendChild(areaBotoesFoto)
  form.appendChild(areaBtnRemover)
  form.appendChild(inputFotoProduto)
  form.appendChild(inputFotoNota)
  form.appendChild(btnConfirmar)

  botoes.parentElement.appendChild(form)
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
  btn.className = 'btn-remover-foto'
  btn.textContent = texto
  return btn
}

async function registrar(id, quantidade, unidade, fotoProduto, fotoNota, botao) {
  botao.disabled = true
  botao.textContent = 'Enviando...'
  const resultado = await api.recebimentos.registrar(id, `${quantidade} ${unidade}`, fotoProduto, fotoNota)
  if (resultado?.erro) {
    alert('Erro ao registrar.')
    botao.disabled = false
    botao.textContent = 'Tentar de novo'
    return
  }
  carregarRecebimentos()
}

async function iniciar() {
  const perfil = exigirPapel(['admin', 'deposito'])
  if (!perfil) return
  montarCabecalho(perfil.papel)
  carregarRecebimentos()
}

iniciar()