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
const MESES_ES = [
  'ENERO',
  'FEBRERO',
  'MARZO',
  'ABRIL',
  'MAYO',
  'JUNIO',
  'JULIO',
  'AGOSTO',
  'SEPTIEMBRE',
  'OCTUBRE',
  'NOVIEMBRE',
  'DICIEMBRE'
]
const UNIDADES = ['CARTONS', 'CANS', 'PACKS']
const LINHAS_EM_BRANCO = 4
const TEXTOS = {
  EN: {
    titulo: 'LOT CODE LIST',
    importador: 'IMPORTER:',
    invoice: 'INVOICE',
    descricao: 'DESCRIPTION',
    lote: 'LOT NUMBER',
    caixas: 'NUMBER OF BOXES PER BATCH',
    fabricacao: 'MANUFACTURING DATE',
    validade: 'BEST BEFORE DATE',
    total: 'PACKS/CANS',
    assinado: 'Signed',
    cargoRotulo: 'Position',
    data: 'Date',
    cargo: 'Food Engineer',
    unidades: { CARTONS: 'CARTONS', CANS: 'CANS', PACKS: 'PACKS' }
  },
  ES: {
    titulo: 'LISTA DE CÓDIGOS DE LOTE',
    importador: 'IMPORTADOR:',
    invoice: 'FACTURA',
    descricao: 'DESCRIPCIÓN',
    lote: 'NÚMERO DE LOTE',
    caixas: 'NÚMERO DE CAJAS POR LOTE',
    fabricacao: 'FECHA DE FABRICACIÓN',
    validade: 'FECHA DE VENCIMIENTO',
    total: 'PAQUETES/LATAS',
    assinado: 'Firmado',
    cargoRotulo: 'Cargo',
    data: 'Fecha',
    cargo: 'Ingeniera de Alimentos',
    unidades: { CARTONS: 'CAJAS', CANS: 'LATAS', PACKS: 'PAQUETES' }
  }
}

let editId = null

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

function dataPorExtenso(iso, idioma) {
  const [ano, mes, dia] = dISO(iso).split('-').map(Number)
  if (!ano || !mes || !dia) return ''
  if (idioma === 'ES') return `${dia} DE ${MESES_ES[mes - 1]} DE ${ano}.`
  return `${MESES_EN[mes - 1]}, ${dia}${sufixoOrdinal(dia)}, ${ano}.`
}

async function baixarWord(id) {
  let resposta
  try {
    resposta = await fetch(`/api/lot-code-list/${id}/word`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
    })
  } catch (_) {
    avisar('Erro de conexão ao gerar o Word.')
    return
  }
  if (!resposta.ok) {
    avisar('Erro ao gerar o Word. Tente novamente.')
    return
  }
  const conteudo = await resposta.blob()
  const disposicao = resposta.headers.get('Content-Disposition') || ''
  const encontrado = /filename="([^"]+)"/.exec(disposicao)
  const endereco = URL.createObjectURL(conteudo)
  const ancora = document.createElement('a')
  ancora.href = endereco
  ancora.download = encontrado ? encontrado[1] : 'Lot_Code_List.docx'
  document.body.appendChild(ancora)
  ancora.click()
  ancora.remove()
  setTimeout(() => URL.revokeObjectURL(endereco), 10000)
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
          <button class="btn btn-sm btn-outline-secondary py-0 px-2" onclick="wordLcl(${l.id})">Word</button>
          <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="excluirLcl(${l.id})">🗑</button>
        </td></tr>`
        )
        .join('')}</tbody></table></div></div>`
        : '<p class="text-muted fst-italic">Nenhuma Lot Code List cadastrada. Clique em "Nova Lot Code List".</p>'
    }`
  $('btn-novo-lcl').addEventListener('click', () => editar(null))
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
window.wordLcl = (id) => baixarWord(id)
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
    <td class="col-fab"><input type="date" min="2000-01-01" max="2100-12-31" class="form-control form-control-sm lt-fabricacao" value="${esc(dISO(l.fabricacao))}" style="min-width:140px"></td>
    <td class="col-val"><input type="date" min="2000-01-01" max="2100-12-31" class="form-control form-control-sm lt-validade" value="${esc(dISO(l.validade))}" style="min-width:140px"></td>
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
      <thead><tr><th>Lote</th><th>Caixas por lote</th><th class="col-fab">Fabricação</th><th class="col-val">Validade</th><th></th></tr></thead>
      <tbody class="lcl-lotes">${lotes.map(linhaLoteHtml).join('')}</tbody>
    </table></div>
    <div class="d-flex justify-content-between align-items-center">
      <button type="button" class="btn btn-sm btn-outline-secondary btn-add-lote">+ Lote</button>
      <span class="small fw-semibold it-total"></span>
    </div>
  </div>`
}

function aplicarTipoData() {
  const tipo = $('l-tipo-data').value
  document.querySelectorAll('#lcl-itens .col-fab').forEach((el) => {
    el.style.display = tipo === 'VALIDADE' ? 'none' : ''
  })
  document.querySelectorAll('#lcl-itens .col-val').forEach((el) => {
    el.style.display = tipo === 'FABRICACAO' ? 'none' : ''
  })
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
  const registro = id ? await api.lotCode.obter(id) : null
  if (id && (!registro || registro.erro)) {
    avisar((registro && registro.erro) || 'Erro ao carregar.')
    verLista()
    return
  }
  const d = registro || {
    fatura: '',
    importador_nome: '',
    importador_endereco: '',
    importador_att: '',
    data_documento: hojeISO(),
    idioma: 'EN',
    tipo_data: 'VALIDADE',
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
        <div class="col-6 col-md-4"><label class="form-label small mb-0">Data do documento</label><input type="date" min="2000-01-01" max="2100-12-31" id="l-data" class="form-control form-control-sm" value="${esc(dISO(d.data_documento))}"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Idioma do documento</label>
          <select id="l-idioma" class="form-select form-select-sm">
            <option value="EN"${d.idioma === 'ES' ? '' : ' selected'}>English</option>
            <option value="ES"${d.idioma === 'ES' ? ' selected' : ''}>Español</option>
          </select></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Datas do lote</label>
          <select id="l-tipo-data" class="form-select form-select-sm">
            <option value="VALIDADE"${!d.tipo_data || d.tipo_data === 'VALIDADE' ? ' selected' : ''}>Validade</option>
            <option value="FABRICACAO"${d.tipo_data === 'FABRICACAO' ? ' selected' : ''}>Fabricação</option>
            <option value="AMBAS"${d.tipo_data === 'AMBAS' ? ' selected' : ''}>Fabricação e validade</option>
          </select></div>
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
      <button class="btn btn-outline-secondary" id="btn-word-lcl">Salvar e gerar Word em branco</button>
    </div>`

  atualizarTotais()
  aplicarTipoData()
  $('l-tipo-data').addEventListener('change', aplicarTipoData)
  $('btn-voltar').addEventListener('click', verLista)
  $('btn-add-produto').addEventListener('click', () => {
    $('lcl-itens').insertAdjacentHTML('beforeend', blocoItemHtml({ descricao: '', unidade: 'CARTONS', lotes: [{}] }))
    atualizarTotais()
    aplicarTipoData()
  })
  const area = $('lcl-itens')
  area.addEventListener('click', (e) => {
    const bloco = e.target.closest('.lcl-item')
    if (!bloco) return
    if (e.target.closest('.btn-add-lote')) {
      bloco.querySelector('.lcl-lotes').insertAdjacentHTML('beforeend', linhaLoteHtml({}))
      aplicarTipoData()
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
  $('btn-word-lcl').addEventListener('click', async () => {
    const salvo = await salvar()
    if (!salvo) return
    await baixarWord(salvo)
  })
}

function coletar() {
  const dados = {
    fatura: $('l-fatura').value,
    data_documento: $('l-data').value,
    idioma: $('l-idioma').value,
    tipo_data: $('l-tipo-data').value,
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
      fabricacao: linha.querySelector('.lt-fabricacao').value,
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
  return editId
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
  const idioma = d.idioma === 'ES' ? 'ES' : 'EN'
  const T = TEXTOS[idioma]
  const temFabricacao = d.tipo_data === 'FABRICACAO' || d.tipo_data === 'AMBAS'
  const temValidade = d.tipo_data !== 'FABRICACAO'
  const itens = d.itens || []
  const enderecos = String(d.importador_endereco || '')
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean)
  const borda = 'border:1px solid #000'
  const tamanhoTitulo = idioma === 'ES' || temFabricacao ? 12 : 15
  const cabecalhoCelula = `${borda};padding:8px 6px;font-size:${tamanhoTitulo}px;font-weight:bold;text-align:center;vertical-align:bottom`
  const celula = `${borda};padding:6px 8px;font-size:11.5px;vertical-align:top`
  const pilha = (lotes, formatar) => {
    if (!lotes.length) return Array.from({ length: LINHAS_EM_BRANCO }, () => '<div style="line-height:2">&nbsp;</div>').join('')
    return lotes.map((l) => `<div style="line-height:2">${formatar(l) || '&nbsp;'}</div>`).join('')
  }

  const linhasTabela = itens
    .map((item) => {
      const lotes = item.lotes || []
      const total = lotes.reduce((soma, l) => soma + (Number(l.caixas) || 0), 0)
      const unidade = T.unidades[item.unidade] || item.unidade
      return `<tr>
        <td style="${celula};width:30%">${esc(item.descricao)}</td>
        <td style="${celula};text-align:center">${pilha(lotes, (l) => esc(l.lote))}</td>
        <td style="${celula};text-align:center">${pilha(lotes, (l) => (l.caixas ? fmtInt(l.caixas) : ''))}</td>
        ${temFabricacao ? `<td style="${celula};text-align:center">${pilha(lotes, (l) => dBR(l.fabricacao))}</td>` : ''}
        ${temValidade ? `<td style="${celula};text-align:center">${pilha(lotes, (l) => dBR(l.validade))}</td>` : ''}
        <td style="${celula};text-align:center">${lotes.length ? `${total} ${esc(unidade)}` : `______ ${esc(unidade)}`}</td>
      </tr>`
    })
    .join('')

  const assinatura = '<img src="/imagens/lot-code-assinatura.jpg" alt="" style="display:block;width:40mm;margin:0 auto 2mm">'

  const html = `
    <div style="position:relative;width:210mm;min-height:296mm;box-sizing:border-box;padding-bottom:36mm;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif">
      <img src="/imagens/lot-code-cabecalho.jpg" alt="" style="display:block;width:100%">
      <img src="/imagens/lot-code-marca.png" alt="" style="position:absolute;left:22mm;top:105mm;width:166mm;z-index:0;opacity:.12">
      <div style="position:relative;z-index:1;padding:9mm 13mm 0 13mm">
        <div style="text-align:center;font-weight:bold;font-size:19px;text-decoration:underline;margin-bottom:9mm">${T.titulo}</div>
        <div style="font-weight:bold;font-size:12.5px;text-decoration:underline;margin-bottom:3mm">${T.importador}</div>
        <div style="margin-left:4mm;font-size:12.5px;line-height:2">
          <div style="font-weight:bold">${esc(d.importador_nome)}</div>
          ${enderecos.map((linha) => `<div>${esc(linha)}</div>`).join('')}
          ${d.importador_att ? `<div>ATT: ${esc(d.importador_att)}</div>` : ''}
        </div>
        <div style="border-bottom:1px solid #000;width:108mm;margin:7mm 0 7mm"></div>
        <div style="margin-left:13mm;font-weight:bold;font-size:12.5px;line-height:2">${T.invoice}: ${esc(d.fatura)}</div>
        <table style="width:100%;border-collapse:collapse;margin-top:7mm">
          <thead><tr>
            <th style="${cabecalhoCelula};text-align:left">${T.descricao}</th>
            <th style="${cabecalhoCelula}">${T.lote}</th>
            <th style="${cabecalhoCelula}">${T.caixas}</th>
            ${temFabricacao ? `<th style="${cabecalhoCelula}">${T.fabricacao}</th>` : ''}
            ${temValidade ? `<th style="${cabecalhoCelula}">${T.validade}</th>` : ''}
            <th style="${cabecalhoCelula}">${T.total}</th>
          </tr></thead>
          <tbody>${linhasTabela}</tbody>
        </table>
        <div style="text-align:center;margin-top:15mm;font-size:12.5px;font-weight:bold;line-height:2;page-break-inside:avoid">
          ${assinatura}
          <div>${T.assinado}: ______________</div>
          <div>${T.cargoRotulo}: ${T.cargo}</div>
          <div>${T.data}: ${esc(dataPorExtenso(d.data_documento, idioma))}</div>
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
