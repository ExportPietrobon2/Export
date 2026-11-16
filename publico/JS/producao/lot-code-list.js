import { api } from '/JS/compartilhado/api.js'
import { exigirPapel } from '/JS/compartilhado/sessao.js'
import { montarCabecalho } from '/JS/compartilhado/cabecalho.js'

const MESES_EN = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER'
]
const UNIDADES = ['CARTONS', 'CANS', 'PACKS']
const CARGO_PADRAO = 'Food Engineer'
const LARGURA_MAXIMA_ASSINATURA = 700
const LIMITE_ASSINATURA = 1800000
const CHAVE_RESPONSAVEL = 'lcl_ultimo_responsavel'

let editId = null
let editRespId = null
let assinaturaAtual

const $ = (id) => document.getElementById(id)
const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
const dISO = (v) => (v ? String(v).slice(0, 10) : '')
const dBR = (v) => {
  const s = dISO(v)
  return s ? s.split('-').reverse().join('/') : ''
}
const fmtInt = (n) => (Number(n) || 0).toLocaleString('pt-BR')
const soDigitos = (v) => String(v == null ? '' : v).replace(/\D/g, '')
const avisar = (mensagem) => window.alert(esc(mensagem))

function hojeISO() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function sufixoOrdinal(dia) {
  if (dia % 100 >= 11 && dia % 100 <= 13) return 'th'
  const ultimo = dia % 10
  if (ultimo === 1) return 'st'
  if (ultimo === 2) return 'nd'
  if (ultimo === 3) return 'rd'
  return 'th'
}

function dataPorExtenso(iso) {
  const [ano, mes, dia] = dISO(iso).split('-').map(Number)
  if (!ano || !mes || !dia) return ''
  return `${MESES_EN[mes - 1]}, ${dia}${sufixoOrdinal(dia)}, ${ano}.`
}

function lerResponsavelSalvo() {
  try {
    return localStorage.getItem(CHAVE_RESPONSAVEL)
  } catch (_) {
    return null
  }
}

function gravarResponsavelSalvo(id) {
  try {
    if (id) localStorage.setItem(CHAVE_RESPONSAVEL, String(id))
  } catch (_) {}
}

function responsavelInicial(responsaveis) {
  const salvo = lerResponsavelSalvo()
  if (salvo && responsaveis.some((r) => String(r.id) === salvo)) return Number(salvo)
  if (responsaveis.length === 1) return responsaveis[0].id
  return null
}

async function verLista() {
  editId = null
  const cont = $('conteudo-lcl')
  cont.innerHTML = '<p class="text-muted">Carregando...</p>'
  const linhas = await api.lotCode.listar()
  if (!Array.isArray(linhas)) {
    cont.innerHTML = '<p class="text-danger">Erro ao carregar.</p>'
    return
  }
  cont.innerHTML = `
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
      <h5 class="secao-titulo-card mb-0">Lot Code Lists cadastradas</h5>
      <div class="d-flex gap-2 flex-wrap">
        <button class="btn btn-outline-secondary" id="btn-responsaveis">Responsáveis</button>
        <button class="btn btn-ok-grande" id="btn-novo-lcl">+ Nova Lot Code List</button>
      </div>
    </div>
    ${
      linhas.length
        ? `<input id="busca-lcl" class="form-control form-control-sm mb-2" placeholder="Buscar por invoice ou importador">
    <div class="card"><div class="table-responsive"><table class="table table-sm table-hover mb-0">
      <thead><tr><th>Invoice</th><th>Importador</th><th>Data</th><th class="text-end">Produtos</th><th class="text-end">Caixas</th><th></th></tr></thead>
      <tbody id="tbody-lcl">${linhas
        .map(
          (l) => `<tr data-busca="${esc((l.fatura + ' ' + l.importador_nome).toLowerCase())}">
        <td class="fw-semibold">${esc(l.fatura)}</td><td>${esc(l.importador_nome)}</td><td>${dBR(l.data_documento)}</td>
        <td class="text-end">${fmtInt(l.total_produtos)}</td><td class="text-end">${fmtInt(l.total_caixas)}</td>
        <td style="white-space:nowrap" class="text-end">
          <button class="btn btn-sm btn-outline-primary py-0 px-2" onclick="editarLcl(${l.id})">Abrir</button>
          <button class="btn btn-sm btn-outline-secondary py-0 px-2" onclick="pdfLcl(${l.id})">PDF</button>
          <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="excluirLcl(${l.id})">🗑</button>
        </td></tr>`
        )
        .join('')}</tbody></table></div></div>`
        : '<p class="text-muted fst-italic">Nenhuma Lot Code List cadastrada. Clique em "Nova Lot Code List".</p>'
    }`
  $('btn-novo-lcl').addEventListener('click', () => editar(null))
  $('btn-responsaveis').addEventListener('click', verResponsaveis)
  const busca = $('busca-lcl')
  if (busca) {
    busca.addEventListener('input', () => {
      const termo = busca.value.trim().toLowerCase()
      document.querySelectorAll('#tbody-lcl tr').forEach((tr) => {
        tr.style.display = !termo || tr.dataset.busca.includes(termo) ? '' : 'none'
      })
    })
  }
}

window.editarLcl = (id) => editar(id)
window.excluirLcl = async function (id) {
  if (!confirm('Excluir esta Lot Code List?')) return
  const r = await api.lotCode.excluir(id)
  if (r?.erro) avisar(r.erro)
  verLista()
}
window.pdfLcl = async function (id) {
  const d = await api.lotCode.obter(id)
  if (!d || d.erro) {
    avisar((d && d.erro) || 'Erro ao carregar.')
    return
  }
  exportarPDF(d)
}

function linhaLoteHtml(l) {
  l = l || {}
  return `<tr class="lcl-lote">
    <td><input class="form-control form-control-sm lt-lote" maxlength="80" value="${esc(l.lote || '')}" style="min-width:90px"></td>
    <td><input class="form-control form-control-sm lt-caixas" inputmode="numeric" maxlength="9" value="${l.caixas ? esc(l.caixas) : ''}" style="min-width:90px"></td>
    <td><input type="date" min="2000-01-01" max="2100-12-31" class="form-control form-control-sm lt-validade" value="${esc(dISO(l.validade))}" style="min-width:140px"></td>
    <td class="text-end"><button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 btn-rem-lote">✕</button></td>
  </tr>`
}

function blocoItemHtml(item) {
  const it = item || {}
  const lotes = it.lotes && it.lotes.length ? it.lotes : [{}]
  return `<div class="border rounded p-2 mb-3 lcl-item">
    <div class="row g-2 align-items-end mb-2">
      <div class="col-12 col-md-7"><label class="form-label small mb-0">Descrição do produto</label>
        <input class="form-control form-control-sm it-descricao" maxlength="300" value="${esc(it.descricao || '')}" placeholder="Ex.: SWEETVIBES JUMBO PARTY MIX 4 X 1,25KG"></div>
      <div class="col-6 col-md-3"><label class="form-label small mb-0">Unidade (Packs/Cans)</label>
        <select class="form-select form-select-sm it-unidade">${UNIDADES.map(
          (u) => `<option value="${u}"${(it.unidade || 'CARTONS') === u ? ' selected' : ''}>${u}</option>`
        ).join('')}</select></div>
      <div class="col-6 col-md-2 text-end"><button type="button" class="btn btn-sm btn-outline-danger btn-rem-produto">Remover produto</button></div>
    </div>
    <div class="table-responsive"><table class="table table-sm mb-1" style="font-size:.85rem">
      <thead><tr><th>Lote</th><th>Caixas por lote</th><th>Validade</th><th></th></tr></thead>
      <tbody class="lcl-lotes">${lotes.map(linhaLoteHtml).join('')}</tbody>
    </table></div>
    <div class="d-flex justify-content-between align-items-center">
      <button type="button" class="btn btn-sm btn-outline-secondary btn-add-lote">+ Lote</button>
      <span class="small fw-semibold it-total"></span>
    </div>
  </div>`
}

function atualizarTotais() {
  document.querySelectorAll('#lcl-itens .lcl-item').forEach((bloco) => {
    const total = [...bloco.querySelectorAll('.lt-caixas')].reduce((s, el) => s + (Number(soDigitos(el.value)) || 0), 0)
    bloco.querySelector('.it-total').textContent = `Total: ${fmtInt(total)} ${bloco.querySelector('.it-unidade').value}`
  })
}

async function editar(id) {
  editId = id
  const cont = $('conteudo-lcl')
  cont.innerHTML = '<p class="text-muted">Carregando...</p>'
  const [responsaveis, registro] = await Promise.all([api.lotCode.responsaveis(), id ? api.lotCode.obter(id) : null])
  if (!Array.isArray(responsaveis) || (id && (!registro || registro.erro))) {
    avisar((registro && registro.erro) || (responsaveis && responsaveis.erro) || 'Erro ao carregar.')
    verLista()
    return
  }
  const d = registro || {
    fatura: '',
    importador_nome: '',
    importador_endereco: '',
    importador_att: '',
    data_documento: hojeISO(),
    responsavel_id: responsavelInicial(responsaveis),
    itens: [{ descricao: '', unidade: 'CARTONS', lotes: [{}] }]
  }
  const itens = d.itens && d.itens.length ? d.itens : [{ descricao: '', unidade: 'CARTONS', lotes: [{}] }]

  cont.innerHTML = `
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
      <h5 class="secao-titulo-card mb-0">${id ? 'Editar Lot Code List' : 'Nova Lot Code List'}</h5>
      <button class="btn btn-sm btn-outline-secondary" id="btn-voltar">← Voltar</button>
    </div>
    <div class="card mb-3"><div class="card-body">
      <div class="row g-2 mb-2">
        <div class="col-12 col-md-4"><label class="form-label small mb-0">Invoice Nº</label><input id="l-fatura" maxlength="60" class="form-control form-control-sm" value="${esc(d.fatura)}" placeholder="Ex.: 125/2026"></div>
        <div class="col-6 col-md-3"><label class="form-label small mb-0">Data do documento</label><input type="date" min="2000-01-01" max="2100-12-31" id="l-data" class="form-control form-control-sm" value="${esc(dISO(d.data_documento))}"></div>
        <div class="col-6 col-md-5"><label class="form-label small mb-0">Responsável (assinatura)</label>
          <select id="l-responsavel" class="form-select form-select-sm"><option value="">Sem responsável</option>${responsaveis
            .map(
              (r) =>
                `<option value="${r.id}"${String(r.id) === String(d.responsavel_id) ? ' selected' : ''}>${esc(r.nome)} — ${esc(r.cargo)}</option>`
            )
            .join('')}</select></div>
      </div>
      <hr>
      <h6 class="fw-bold small text-uppercase text-muted">Importador</h6>
      <div class="row g-2">
        <div class="col-12 col-md-6"><label class="form-label small mb-0">Nome</label><input id="l-imp-nome" maxlength="200" class="form-control form-control-sm" value="${esc(d.importador_nome)}"></div>
        <div class="col-12 col-md-6"><label class="form-label small mb-0">ATT (contato)</label><input id="l-imp-att" maxlength="160" class="form-control form-control-sm" value="${esc(d.importador_att || '')}"></div>
        <div class="col-12"><label class="form-label small mb-0">Endereço (uma linha por linha do documento)</label><textarea id="l-imp-endereco" maxlength="400" rows="2" class="form-control form-control-sm">${esc(d.importador_endereco || '')}</textarea></div>
      </div>
    </div></div>

    <div class="card mb-3"><div class="card-body">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h6 class="fw-bold mb-0">Produtos e lotes</h6>
        <button type="button" class="btn btn-sm btn-outline-danger" id="btn-add-produto">+ Adicionar produto</button>
      </div>
      <div id="lcl-itens">${itens.map(blocoItemHtml).join('')}</div>
    </div></div>

    <div class="d-flex gap-2 flex-wrap">
      <button class="btn btn-ok-grande" id="btn-salvar-lcl">Salvar</button>
      <button class="btn btn-outline-danger" id="btn-pdf-lcl">Salvar e exportar PDF</button>
    </div>`

  atualizarTotais()
  $('btn-voltar').addEventListener('click', verLista)
  $('btn-add-produto').addEventListener('click', () => {
    $('lcl-itens').insertAdjacentHTML('beforeend', blocoItemHtml({ descricao: '', unidade: 'CARTONS', lotes: [{}] }))
    atualizarTotais()
  })
  const area = $('lcl-itens')
  area.addEventListener('click', (e) => {
    const bloco = e.target.closest('.lcl-item')
    if (!bloco) return
    if (e.target.closest('.btn-add-lote')) {
      bloco.querySelector('.lcl-lotes').insertAdjacentHTML('beforeend', linhaLoteHtml({}))
    } else if (e.target.closest('.btn-rem-lote')) {
      e.target.closest('tr').remove()
    } else if (e.target.closest('.btn-rem-produto')) {
      if (!confirm('Remover este produto e seus lotes?')) return
      bloco.remove()
    } else {
      return
    }
    atualizarTotais()
  })
  area.addEventListener('input', (e) => {
    if (e.target.classList.contains('lt-caixas')) {
      const limpo = soDigitos(e.target.value)
      if (limpo !== e.target.value) e.target.value = limpo
      atualizarTotais()
    }
  })
  area.addEventListener('change', (e) => {
    if (e.target.classList.contains('it-unidade')) atualizarTotais()
  })
  $('btn-salvar-lcl').addEventListener('click', async () => {
    const salvo = await salvar()
    if (salvo) verLista()
  })
  $('btn-pdf-lcl').addEventListener('click', async () => {
    const salvo = await salvar()
    if (!salvo) return
    const completo = await api.lotCode.obter(salvo)
    if (!completo || completo.erro) {
      avisar((completo && completo.erro) || 'Erro ao carregar.')
      return
    }
    exportarPDF(completo)
  })
}

function coletar() {
  const dados = {
    fatura: $('l-fatura').value,
    data_documento: $('l-data').value,
    responsavel_id: $('l-responsavel').value || null,
    importador_nome: $('l-imp-nome').value,
    importador_endereco: $('l-imp-endereco').value,
    importador_att: $('l-imp-att').value
  }
  dados.itens = [...document.querySelectorAll('#lcl-itens .lcl-item')].map((bloco) => ({
    descricao: bloco.querySelector('.it-descricao').value,
    unidade: bloco.querySelector('.it-unidade').value,
    lotes: [...bloco.querySelectorAll('.lcl-lote')].map((linha) => ({
      lote: linha.querySelector('.lt-lote').value,
      caixas: linha.querySelector('.lt-caixas').value,
      validade: linha.querySelector('.lt-validade').value
    }))
  }))
  return dados
}

async function salvar() {
  const dados = coletar()
  const r = editId ? await api.lotCode.editar(editId, dados) : await api.lotCode.criar(dados)
  if (!r || r.erro) {
    avisar((r && r.erro) || 'Erro ao salvar.')
    return null
  }
  if (!editId) editId = r.id
  gravarResponsavelSalvo(dados.responsavel_id)
  return editId
}

async function verResponsaveis() {
  editRespId = null
  const cont = $('conteudo-lcl')
  cont.innerHTML = '<p class="text-muted">Carregando...</p>'
  const linhas = await api.lotCode.responsaveis()
  if (!Array.isArray(linhas)) {
    cont.innerHTML = '<p class="text-danger">Erro ao carregar.</p>'
    return
  }
  cont.innerHTML = `
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
      <h5 class="secao-titulo-card mb-0">Responsáveis pela assinatura</h5>
      <div class="d-flex gap-2 flex-wrap">
        <button class="btn btn-sm btn-outline-secondary" id="btn-voltar">← Voltar</button>
        <button class="btn btn-ok-grande" id="btn-novo-resp">+ Novo responsável</button>
      </div>
    </div>
    ${
      linhas.length
        ? `<div class="card"><div class="table-responsive"><table class="table table-sm table-hover mb-0">
      <thead><tr><th>Nome</th><th>Cargo</th><th>Assinatura</th><th></th></tr></thead>
      <tbody>${linhas
        .map(
          (r) => `<tr><td class="fw-semibold">${esc(r.nome)}</td><td>${esc(r.cargo)}</td>
        <td>${r.tem_assinatura ? 'Cadastrada' : '<span class="text-muted">Sem imagem</span>'}</td>
        <td style="white-space:nowrap" class="text-end">
          <button class="btn btn-sm btn-outline-primary py-0 px-2" onclick="editarResp(${r.id})">Abrir</button>
          <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="excluirResp(${r.id})">🗑</button>
        </td></tr>`
        )
        .join('')}</tbody></table></div></div>`
        : '<p class="text-muted fst-italic">Nenhum responsável cadastrado. Clique em "Novo responsável".</p>'
    }`
  $('btn-voltar').addEventListener('click', verLista)
  $('btn-novo-resp').addEventListener('click', () => editarResponsavel(null))
}

window.editarResp = (id) => editarResponsavel(id)
window.excluirResp = async function (id) {
  if (!confirm('Excluir este responsável?')) return
  const r = await api.lotCode.excluirResponsavel(id)
  if (r?.erro) avisar(r.erro)
  verResponsaveis()
}

function lerImagem(arquivo) {
  return new Promise((resolver, rejeitar) => {
    if (!/^image\/(png|jpeg)$/.test(arquivo.type)) {
      rejeitar(new Error('Use uma imagem PNG ou JPEG.'))
      return
    }
    const leitor = new FileReader()
    leitor.onerror = () => rejeitar(new Error('Não foi possível ler a imagem.'))
    leitor.onload = () => {
      const imagem = new Image()
      imagem.onerror = () => rejeitar(new Error('Imagem inválida.'))
      imagem.onload = () => {
        const escala = Math.min(1, LARGURA_MAXIMA_ASSINATURA / imagem.naturalWidth)
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(imagem.naturalWidth * escala))
        canvas.height = Math.max(1, Math.round(imagem.naturalHeight * escala))
        const contexto = canvas.getContext('2d')
        const ehPng = arquivo.type === 'image/png'
        if (!ehPng) {
          contexto.fillStyle = '#fff'
          contexto.fillRect(0, 0, canvas.width, canvas.height)
        }
        contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height)
        const resultado = ehPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.9)
        if (resultado.length > LIMITE_ASSINATURA) {
          rejeitar(new Error('A imagem da assinatura é grande demais. Use uma imagem menor.'))
          return
        }
        resolver(resultado)
      }
      imagem.src = leitor.result
    }
    leitor.readAsDataURL(arquivo)
  })
}

function mostrarPreviaAssinatura(origem) {
  const previa = $('r-previa')
  const botao = $('btn-remover-assinatura')
  if (origem) {
    previa.src = origem
    previa.style.display = 'block'
    botao.style.display = 'inline-block'
  } else {
    previa.removeAttribute('src')
    previa.style.display = 'none'
    botao.style.display = 'none'
  }
}

async function editarResponsavel(id) {
  editRespId = id
  assinaturaAtual = undefined
  let d = { nome: '', cargo: CARGO_PADRAO, assinatura: null }
  if (id) {
    d = await api.lotCode.obterResponsavel(id)
    if (!d || d.erro) {
      avisar((d && d.erro) || 'Erro ao carregar.')
      verResponsaveis()
      return
    }
  }
  const cont = $('conteudo-lcl')
  cont.innerHTML = `
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
      <h5 class="secao-titulo-card mb-0">${id ? 'Editar responsável' : 'Novo responsável'}</h5>
      <button class="btn btn-sm btn-outline-secondary" id="btn-voltar">← Voltar</button>
    </div>
    <div class="card mb-3"><div class="card-body">
      <div class="row g-2">
        <div class="col-12 col-md-6"><label class="form-label small mb-0">Nome</label><input id="r-nome" maxlength="160" class="form-control form-control-sm" value="${esc(d.nome)}"></div>
        <div class="col-12 col-md-6"><label class="form-label small mb-0">Cargo (Position)</label><input id="r-cargo" maxlength="120" class="form-control form-control-sm" value="${esc(d.cargo)}"></div>
        <div class="col-12">
          <label class="form-label small mb-0">Imagem da assinatura (PNG ou JPEG)</label>
          <input type="file" id="r-arquivo" accept="image/png,image/jpeg" class="form-control form-control-sm">
          <img id="r-previa" alt="Assinatura" class="border rounded mt-2 bg-white" style="display:none;max-height:110px;max-width:100%">
          <div><button type="button" id="btn-remover-assinatura" class="btn btn-sm btn-outline-danger mt-2" style="display:none">Remover assinatura</button></div>
        </div>
      </div>
    </div></div>
    <div class="d-flex gap-2 flex-wrap"><button class="btn btn-ok-grande" id="btn-salvar-resp">Salvar</button></div>`

  mostrarPreviaAssinatura(d.assinatura)
  $('btn-voltar').addEventListener('click', verResponsaveis)
  $('r-arquivo').addEventListener('change', async (e) => {
    const arquivo = e.target.files && e.target.files[0]
    if (!arquivo) return
    try {
      assinaturaAtual = await lerImagem(arquivo)
      mostrarPreviaAssinatura(assinaturaAtual)
    } catch (erro) {
      e.target.value = ''
      avisar(erro.message)
    }
  })
  $('btn-remover-assinatura').addEventListener('click', () => {
    assinaturaAtual = null
    $('r-arquivo').value = ''
    mostrarPreviaAssinatura(null)
  })
  $('btn-salvar-resp').addEventListener('click', async () => {
    const dados = { nome: $('r-nome').value, cargo: $('r-cargo').value }
    if (assinaturaAtual !== undefined) dados.assinatura = assinaturaAtual
    const r = editRespId ? await api.lotCode.editarResponsavel(editRespId, dados) : await api.lotCode.criarResponsavel(dados)
    if (!r || r.erro) {
      avisar((r && r.erro) || 'Erro ao salvar.')
      return
    }
    verResponsaveis()
  })
}

function aguardarImagens(area) {
  const pendentes = [...area.querySelectorAll('img')].filter((img) => !img.complete)
  return Promise.all(
    pendentes.map(
      (img) =>
        new Promise((resolver) => {
          img.onload = resolver
          img.onerror = resolver
        })
    )
  )
}

async function exportarPDF(d) {
  const itens = d.itens || []
  const enderecos = String(d.importador_endereco || '')
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean)
  const responsavel = d.responsavel || null
  const borda = 'border:1px solid #000'
  const cabecalhoCelula = `${borda};padding:8px 6px;font-size:15px;font-weight:bold;text-align:center;vertical-align:bottom`
  const celula = `${borda};padding:6px 8px;font-size:11.5px;vertical-align:top`
  const pilha = (lotes, formatar) => lotes.map((l) => `<div style="line-height:2">${formatar(l)}</div>`).join('')

  const linhasTabela = itens
    .map((item) => {
      const lotes = item.lotes || []
      const total = lotes.reduce((soma, l) => soma + (Number(l.caixas) || 0), 0)
      return `<tr>
        <td style="${celula};width:36%">${esc(item.descricao)}</td>
        <td style="${celula};text-align:center">${pilha(lotes, (l) => esc(l.lote))}</td>
        <td style="${celula};text-align:center">${pilha(lotes, (l) => fmtInt(l.caixas))}</td>
        <td style="${celula};text-align:center">${pilha(lotes, (l) => dBR(l.validade))}</td>
        <td style="${celula};text-align:center">${total} ${esc(item.unidade)}</td>
      </tr>`
    })
    .join('')

  const assinatura =
    responsavel && responsavel.assinatura
      ? `<img src="${responsavel.assinatura}" alt="" style="display:block;width:40mm;margin:0 auto 2mm">`
      : '<div style="height:22mm"></div>'

  const html = `
    <div style="position:relative;width:210mm;min-height:296mm;box-sizing:border-box;padding-bottom:36mm;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif">
      <img src="/imagens/lot-code-cabecalho.jpg" alt="" style="display:block;width:100%">
      <img src="/imagens/lot-code-marca.png" alt="" style="position:absolute;left:22mm;top:105mm;width:166mm;z-index:0;opacity:.12">
      <div style="position:relative;z-index:1;padding:9mm 13mm 0 13mm">
        <div style="text-align:center;font-weight:bold;font-size:19px;text-decoration:underline;margin-bottom:9mm">LOT CODE LIST</div>
        <div style="font-weight:bold;font-size:12.5px;text-decoration:underline;margin-bottom:3mm">IMPORTER:</div>
        <div style="margin-left:4mm;font-size:12.5px;line-height:2">
          <div style="font-weight:bold">${esc(d.importador_nome)}</div>
          ${enderecos.map((linha) => `<div>${esc(linha)}</div>`).join('')}
          ${d.importador_att ? `<div>ATT: ${esc(d.importador_att)}</div>` : ''}
        </div>
        <div style="border-bottom:1px solid #000;width:108mm;margin:7mm 0 7mm"></div>
        <div style="margin-left:13mm;font-weight:bold;font-size:12.5px;line-height:2">INVOICE: ${esc(d.fatura)}</div>
        <table style="width:100%;border-collapse:collapse;margin-top:7mm">
          <thead><tr>
            <th style="${cabecalhoCelula};text-align:left">DESCRIPTION</th>
            <th style="${cabecalhoCelula}">LOT NUMBER</th>
            <th style="${cabecalhoCelula}">NUMBER OF BOXES PER BATCH</th>
            <th style="${cabecalhoCelula}">BEST BEFORE DATE</th>
            <th style="${cabecalhoCelula}">PACKS/CANS</th>
          </tr></thead>
          <tbody>${linhasTabela}</tbody>
        </table>
        <div style="text-align:center;margin-top:15mm;font-size:12.5px;font-weight:bold;line-height:2;page-break-inside:avoid">
          ${assinatura}
          <div>Signed: ______________</div>
          <div>Position: ${esc(responsavel ? responsavel.cargo : '')}</div>
          <div>Date: ${esc(dataPorExtenso(d.data_documento))}</div>
        </div>
      </div>
      <img src="/imagens/lot-code-rodape.jpg" alt="" style="position:absolute;left:0;bottom:0;width:100%">
    </div>`

  let area = document.getElementById('area-impressao')
  if (!area) {
    area = document.createElement('div')
    area.id = 'area-impressao'
    area.style.display = 'none'
    document.body.appendChild(area)
  }
  area.innerHTML = html

  const estiloPagina = document.createElement('style')
  estiloPagina.id = 'estilo-pagina-lcl'
  estiloPagina.textContent = '@media print { @page { size: A4 portrait; margin: 0 } body.imprimindo { margin: 0 } }'
  document.head.appendChild(estiloPagina)
  document.body.classList.add('imprimindo')
  const limpar = () => {
    document.body.classList.remove('imprimindo')
    estiloPagina.remove()
    window.removeEventListener('afterprint', limpar)
  }
  window.addEventListener('afterprint', limpar)
  await aguardarImagens(area)
  window.print()
}

async function iniciar() {
  const perfil = exigirPapel('todos')
  if (!perfil) return
  montarCabecalho()
  verLista()
}

iniciar()
