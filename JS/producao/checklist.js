import { api } from '/JS/core/api.js'
import { exigirPapel } from '/JS/core/auth.js'
import { montarCabecalho } from '/JS/core/cabecalho.js'

const EMAILS_CHECKLIST = ['export2@pietrobon.com.br', 'export@pietrobon.com.br']
const EXPORTADOR = ['PIETROBON & CIA. LTDA.', 'Rua Osvaldo Cruz, 126', 'Tapejara - RS - Brasil', 'CNPJ 97.580.260/0001-15']

let editId = null
const $ = (id) => document.getElementById(id)
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const dISO = (v) => v ? String(v).slice(0, 10) : ''
const dBR = (v) => { const s = dISO(v); return s ? s.split('-').reverse().join('/') : '' }
function somaCaixas(itens) {
  return itens.reduce((s, it) => {
    const n = parseFloat(String(it.qtd_cx || '').replace(/\./g, '').replace(',', '.')) || 0
    return s + n
  }, 0)
}
function fmtInt(n) { return (Number(n) || 0).toLocaleString('pt-BR') }

// ---------- LISTA ----------
async function verLista() {
  editId = null
  const cont = $('conteudo-cl')
  cont.innerHTML = '<p class="text-muted">Carregando...</p>'
  const rows = await api.checklist.listar()
  if (!Array.isArray(rows)) { cont.innerHTML = '<p class="text-danger">Erro ao carregar.</p>'; return }
  cont.innerHTML = `
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
      <h5 class="secao-titulo-card mb-0">Check-lists cadastrados</h5>
      <button class="btn btn-ok-grande" id="btn-novo-cl">+ Novo check-list</button>
    </div>
    ${rows.length ? `<div class="card"><div class="table-responsive"><table class="table table-sm table-hover mb-0">
      <thead><tr><th>Fatura</th><th>Pedido</th><th>Cliente</th><th>Destino</th><th>Data emb.</th><th></th></tr></thead>
      <tbody>${rows.map((c) => `<tr>
        <td class="fw-semibold">${esc(c.fatura || '-')}</td><td>${esc(c.pedido || '-')}</td>
        <td>${esc(c.cliente_nome || '-')}</td><td>${esc(c.destino || '-')}</td><td>${dBR(c.data_emb)}</td>
        <td style="white-space:nowrap" class="text-end">
          <button class="btn btn-sm btn-outline-primary py-0 px-2" onclick="editarCl(${c.id})">Abrir</button>
          <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="excluirCl(${c.id})">🗑</button>
        </td></tr>`).join('')}</tbody></table></div></div>`
      : '<p class="text-muted fst-italic">Nenhum check-list cadastrado. Clique em "Novo check-list".</p>'}`
  $('btn-novo-cl').addEventListener('click', () => editar(null))
}

window.editarCl = (id) => editar(id)
window.excluirCl = async function (id) {
  if (!confirm('Excluir este check-list?')) return
  await api.checklist.excluir(id)
  verLista()
}

// ---------- EDITOR ----------
function linhaItemHtml(it) {
  it = it || {}
  return `<tr class="cl-item">
    <td><input class="form-control form-control-sm it-produto" value="${esc(it.produto || '')}"></td>
    <td><input class="form-control form-control-sm it-gramatura" value="${esc(it.gramatura || '')}" style="min-width:90px"></td>
    <td><input class="form-control form-control-sm it-qtd_cx" value="${esc(it.qtd_cx || '')}" style="min-width:80px"></td>
    <td><input class="form-control form-control-sm it-lote" value="${esc(it.lote || '')}" style="min-width:90px"></td>
    <td><input class="form-control form-control-sm it-validade" value="${esc(it.validade || '')}" style="min-width:90px"></td>
    <td class="text-end"><button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 btn-rem-item">✕</button></td>
  </tr>`
}

async function editar(id) {
  editId = id
  let d = { itens: [{}, {}, {}] }
  if (id) { d = await api.checklist.obter(id); if (!d.itens || !d.itens.length) d.itens = [{}] }
  const cont = $('conteudo-cl')
  cont.innerHTML = `
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
      <h5 class="secao-titulo-card mb-0">${id ? 'Editar check-list' : 'Novo check-list'}</h5>
      <button class="btn btn-sm btn-outline-secondary" id="btn-voltar">← Voltar</button>
    </div>
    <div class="card mb-3"><div class="card-body">
      <div class="row g-2 mb-2">
        <div class="col-6 col-md-3"><label class="form-label small mb-0">Fatura / INV Nº</label><input id="c-fatura" class="form-control form-control-sm" value="${esc(d.fatura || '')}"></div>
        <div class="col-6 col-md-3"><label class="form-label small mb-0">Pedido Nº</label><input id="c-pedido" class="form-control form-control-sm" value="${esc(d.pedido || '')}"></div>
        <div class="col-6 col-md-3"><label class="form-label small mb-0">Data do embarque</label><input type="date" id="c-data_emb" class="form-control form-control-sm" value="${dISO(d.data_emb)}"></div>
      </div>
      <hr>
      <div class="row g-3">
        <div class="col-12 col-md-6">
          <h6 class="fw-bold small text-uppercase text-muted">Importador / Consignatário</h6>
          <label class="form-label small mb-0">Cliente</label><input id="c-cliente_nome" class="form-control form-control-sm mb-1" value="${esc(d.cliente_nome || '')}">
          <label class="form-label small mb-0">Endereço</label><input id="c-cliente_endereco" class="form-control form-control-sm mb-1" value="${esc(d.cliente_endereco || '')}">
          <label class="form-label small mb-0">Contato</label><input id="c-cliente_contato" class="form-control form-control-sm" value="${esc(d.cliente_contato || '')}">
        </div>
        <div class="col-12 col-md-6">
          <h6 class="fw-bold small text-uppercase text-muted">Embarque</h6>
          <label class="form-label small mb-0">Local de embarque</label><input id="c-embarque" class="form-control form-control-sm mb-1" value="${esc(d.embarque || '')}" placeholder="Ex.: Rio Grande – RS">
          <label class="form-label small mb-0">Descarga</label><input id="c-descarga" class="form-control form-control-sm mb-1" value="${esc(d.descarga || '')}">
          <label class="form-label small mb-0">Destino</label><input id="c-destino" class="form-control form-control-sm" value="${esc(d.destino || '')}">
        </div>
      </div>
    </div></div>

    <div class="card mb-3"><div class="card-body">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h6 class="fw-bold mb-0">Produtos / Itens</h6>
        <button type="button" class="btn btn-sm btn-outline-danger" id="btn-add-item">+ Adicionar item</button>
      </div>
      <div class="table-responsive"><table class="table table-sm mb-0" style="font-size:.85rem">
        <thead><tr><th>Produto</th><th>Gramatura</th><th>Qtd (cx)</th><th>Lote</th><th>Validade</th><th></th></tr></thead>
        <tbody id="cl-itens">${d.itens.map(linhaItemHtml).join('')}</tbody>
      </table></div>
      <div class="row g-2 mt-2">
        <div class="col-6 col-md-3"><label class="form-label small mb-0">Peso líquido (kg)</label><input id="c-peso_liquido" class="form-control form-control-sm" value="${esc(d.peso_liquido || '')}"></div>
        <div class="col-6 col-md-3"><label class="form-label small mb-0">Peso bruto (kg)</label><input id="c-peso_bruto" class="form-control form-control-sm" value="${esc(d.peso_bruto || '')}"></div>
        <div class="col-6 col-md-3"><label class="form-label small mb-0">Volume (m³)</label><input id="c-volume" class="form-control form-control-sm" value="${esc(d.volume || '')}"></div>
      </div>
    </div></div>

    <div class="card mb-3"><div class="card-body">
      <label class="form-label small mb-0 fw-semibold">Observações</label>
      <textarea id="c-observacoes" class="form-control form-control-sm" rows="2">${esc(d.observacoes || '')}</textarea>
    </div></div>

    <div class="d-flex gap-2 flex-wrap">
      <button class="btn btn-ok-grande" id="btn-salvar-cl">Salvar</button>
      <button class="btn btn-outline-danger" id="btn-pdf-cl">Salvar e exportar PDF</button>
    </div>`

  $('btn-voltar').addEventListener('click', verLista)
  $('btn-add-item').addEventListener('click', () => { $('cl-itens').insertAdjacentHTML('beforeend', linhaItemHtml({})) })
  $('cl-itens').addEventListener('click', (e) => { const b = e.target.closest('.btn-rem-item'); if (b) b.closest('tr').remove() })
  $('btn-salvar-cl').addEventListener('click', async () => { const r = await salvar(); if (r) verLista() })
  $('btn-pdf-cl').addEventListener('click', async () => { const r = await salvar(); if (r) exportarPDF(r) })
}

function coletar() {
  const dados = {}
  ;['fatura', 'pedido', 'data_emb', 'cliente_nome', 'cliente_endereco', 'cliente_contato', 'embarque', 'descarga', 'destino', 'peso_liquido', 'peso_bruto', 'volume', 'observacoes'].forEach((k) => { dados[k] = $('c-' + k).value })
  dados.itens = [...document.querySelectorAll('#cl-itens .cl-item')].map((tr) => ({
    produto: tr.querySelector('.it-produto').value,
    gramatura: tr.querySelector('.it-gramatura').value,
    qtd_cx: tr.querySelector('.it-qtd_cx').value,
    lote: tr.querySelector('.it-lote').value,
    validade: tr.querySelector('.it-validade').value
  })).filter((it) => it.produto || it.gramatura || it.qtd_cx)
  return dados
}

async function salvar() {
  const dados = coletar()
  let r
  if (editId) { r = await api.checklist.editar(editId, dados); if (r?.erro) { alert(r.erro); return null } return { id: editId, ...dados } }
  r = await api.checklist.criar(dados)
  if (r?.erro) { alert(r.erro); return null }
  editId = r.id
  return { id: r.id, ...dados }
}

// ---------- PDF (layout do documento) ----------
function exportarPDF(d) {
  const itens = d.itens || []
  const totalCx = somaCaixas(itens)
  const bloco = (titulo, linhas) => `<td style="border:1px solid #000;padding:6px 8px;vertical-align:top;width:33%">
    <div style="font-weight:bold;font-size:10px;text-transform:uppercase;margin-bottom:4px">${titulo}</div>
    <div style="font-size:10px;line-height:1.5">${linhas}</div></td>`
  const th = 'border:1px solid #000;padding:4px 5px;font-size:9.5px;font-weight:bold;background:#e6e6e6;text-align:center'
  const td = (al) => `border:1px solid #000;padding:4px 5px;font-size:9.5px;text-align:${al}`

  const html = `
    <div style="font-family:Arial,sans-serif;color:#000">
      <table style="width:100%;border-collapse:collapse;margin-bottom:2px">
        <tr><td style="border:1px solid #000;padding:6px;text-align:center;font-weight:bold;font-size:14px">CHECK-LIST DE EXPEDIÇÃO</td></tr>
        <tr><td style="border:1px solid #000;padding:5px 8px;font-size:10px"><strong>Fatura / INV Nº:</strong> ${esc(d.fatura || '')} &nbsp;&nbsp;&nbsp; <strong>Pedido Nº:</strong> ${esc(d.pedido || '')}</td></tr>
      </table>
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px"><tr>
        ${bloco('Exportador', EXPORTADOR.join('<br>'))}
        ${bloco('Importador / Consignatário', `Cliente: ${esc(d.cliente_nome || '')}<br>Endereço: ${esc(d.cliente_endereco || '')}<br>Contato: ${esc(d.cliente_contato || 'N/A')}`)}
        ${bloco('Embarque', `Data: ${dBR(d.data_emb) || '____'}<br>Embarque: ${esc(d.embarque || '')}<br>Descarga: ${esc(d.descarga || '')}<br>Destino: ${esc(d.destino || '')}`)}
      </tr></table>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="${th};width:26px">✓</th><th style="${th};width:26px">Nº</th><th style="${th};text-align:left">PRODUTO</th>
          <th style="${th}">GRAMATURA</th><th style="${th}">QTD (cx)</th><th style="${th}">LOTE</th><th style="${th}">VALID.</th><th style="${th}">CONF.</th>
        </tr></thead>
        <tbody>
          ${itens.map((it, i) => `<tr>
            <td style="${td('center')};font-size:12px">&#9744;</td>
            <td style="${td('center')}">${i + 1}</td>
            <td style="${td('left')}">${esc(it.produto || '')}</td>
            <td style="${td('center')}">${esc(it.gramatura || '')}</td>
            <td style="${td('center')}">${esc(it.qtd_cx || '')}</td>
            <td style="${td('center')}">${esc(it.lote || '')}</td>
            <td style="${td('center')}">${esc(it.validade || '')}</td>
            <td style="${td('center')}"></td>
          </tr>`).join('')}
          <tr style="background:#f0f0f0;font-weight:bold">
            <td colspan="4" style="${td('right')}">TOTAL DE ITENS: ${itens.length}</td>
            <td style="${td('center')}">${fmtInt(totalCx)} cx</td>
            <td colspan="3" style="${td('left')}">Peso líq.: ${esc(d.peso_liquido || '—')} kg &nbsp;·&nbsp; Peso bruto: ${esc(d.peso_bruto || '—')} kg &nbsp;·&nbsp; Volume: ${esc(d.volume || '—')} m³</td>
          </tr>
        </tbody>
      </table>
      <div style="font-size:10px;margin-top:10px"><strong>Observações:</strong> ${esc(d.observacoes || '')}</div>
      <div style="margin-top:48px;font-size:10px">
        ____________________________________<br>
        Responsável pela Expedição<br>
        Tapejara - RS, Brasil &nbsp;&nbsp;&nbsp; Data: ____ / ____ / ______
      </div>
    </div>`

  let area = document.getElementById('area-impressao')
  if (!area) { area = document.createElement('div'); area.id = 'area-impressao'; area.style.display = 'none'; document.body.appendChild(area) }
  area.innerHTML = html
  document.body.classList.add('imprimindo')
  const limpar = () => { document.body.classList.remove('imprimindo'); window.removeEventListener('afterprint', limpar) }
  window.addEventListener('afterprint', limpar)
  window.print()
}

async function iniciar() {
  const perfil = exigirPapel(['admin'])
  if (!perfil) return
  if (!EMAILS_CHECKLIST.includes((perfil.email || '').toLowerCase())) { window.location.href = '/HTML/producao/admin.html'; return }
  montarCabecalho(perfil.papel)
  verLista()
}

iniciar()