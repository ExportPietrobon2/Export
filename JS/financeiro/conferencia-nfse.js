import { exigirPapel } from '/JS/core/auth.js'
import { montarCabecalho } from '/JS/core/cabecalho.js'

const EMAILS_PERMITIDOS = ['export2@pietrobon.com.br', 'export@pietrobon.com.br', 'joaoantonio@pietrobon.com.br']
const ALIQUOTA_IRRF = 0.015
const ALIQUOTA_ISSQN = 0.02
const TOLERANCIA = 0.05

const $ = (id) => document.getElementById(id)
const brl = (n) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

let historico = []

function obterToken() {
  return sessionStorage.getItem('token') || localStorage.getItem('token_deposito')
}

async function carregarPdfJs() {
  if (window.pdfjsLib) return
  await new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
}

async function extrairTextoPdf(arquivo) {
  await carregarPdfJs()
  const arrayBuffer = await arquivo.arrayBuffer()
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise
  let texto = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const pagina = await pdf.getPage(i)
    const conteudo = await pagina.getTextContent()
    texto += conteudo.items.map(item => item.str).join(' ') + '\n'
  }
  return texto.trim()
}

async function extrairDadosNfse(textoNfse, aliquotaIssqn) {
  const token = obterToken()
  const resposta = await fetch('/api/conferencia-nfse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ textoNfse, aliquotaIssqn })
  })
  const json = await resposta.json()
  if (json.erro) throw new Error(json.erro)
  return json.dados
}

function conferirCalculos(dados, aliquotaIssqn) {
  const resultados = []
  const valorBase = Number(dados.valor_comissao) || 0
  const dozeAvosDeclarado = Number(dados.valor_doze_avos) || 0
  const dozeAvosEsperado = valorBase / 12
  const totalDeclarado = Number(dados.valor_total_declarado) || 0
  const totalEsperado = valorBase + dozeAvosEsperado
  const irrfDeclarado = Number(dados.irrf_declarado) || 0
  const irrfEsperado = totalDeclarado * ALIQUOTA_IRRF
  const issqnDeclarado = Number(dados.issqn_declarado) || 0
  const issqnEsperado = totalDeclarado * (aliquotaIssqn / 100)
  const valorLiquido = Number(dados.valor_liquido) || 0
  const liquidoEsperado = totalDeclarado - irrfDeclarado

  const verificar = (rotulo, declarado, esperado, detalhe) => {
    const diferenca = Math.abs(declarado - esperado)
    resultados.push({ rotulo, declarado, esperado, ok: diferenca <= TOLERANCIA, diferenca, detalhe })
  }

  verificar('1/12 avos', dozeAvosDeclarado, dozeAvosEsperado, `Comissão (${brl(valorBase)}) ÷ 12`)
  verificar('Total da NFS-e (comissão + 1/12)', totalDeclarado, totalEsperado, `${brl(valorBase)} + ${brl(dozeAvosEsperado)}`)
  verificar('IRRF retido (1,5%)', irrfDeclarado, irrfEsperado, `${brl(totalDeclarado)} × 1,5%`)
  verificar(`ISSQN (${aliquotaIssqn.toFixed(2)}%)`, issqnDeclarado, issqnEsperado, `${brl(totalDeclarado)} × ${aliquotaIssqn}%`)
  verificar('Valor líquido da NFS-e', valorLiquido, liquidoEsperado, `${brl(totalDeclarado)} − IRRF ${brl(irrfDeclarado)}`)

  return resultados
}

async function analisarComGemini(dados, resultados) {
  const pendencias = resultados.filter(r => !r.ok)
  const prompt = pendencias.length === 0
    ? `NFS-e de comissão conferida — todos os cálculos estão corretos. Emitente: ${dados.emitente}. Valor total: ${brl(dados.valor_total_declarado)}. Confirme em 2 linhas de forma profissional.`
    : `NFS-e com ${pendencias.length} divergência(s): ${pendencias.map(p => `${p.rotulo}: declarado ${brl(p.declarado)}, esperado ${brl(p.esperado)}`).join('; ')}. Descreva o problema de forma clara em até 3 linhas.`

  const token = obterToken()
  const resposta = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ mensagem: prompt, historico: [] })
  })
  const json = await resposta.json()
  return json.resposta || ''
}

function renderizarResultado(dados, resultados, analise) {
  const container = $('resultado-conferencia')
  if (!container) return

  const totalErros = resultados.filter(r => !r.ok).length
  const tudoOk = totalErros === 0
  const corGeral = tudoOk ? '#e9f7ef' : '#fff8f0'
  const bordaGeral = tudoOk ? '#a8d5b5' : '#f5c6a0'

  const linhas = resultados.map(r => `
    <div class="d-flex justify-content-between align-items-start py-2 border-bottom gap-3">
      <div>
        <div class="fw-semibold small">${esc(r.rotulo)}</div>
        <div class="text-muted" style="font-size:.78rem">${esc(r.detalhe)}</div>
      </div>
      <div class="text-end" style="min-width:200px">
        <div class="small"><span class="text-muted">Declarado:</span> <strong>${brl(r.declarado)}</strong></div>
        <div class="small"><span class="text-muted">Esperado:</span> <strong>${brl(r.esperado)}</strong></div>
        ${!r.ok ? `<div class="text-danger small fw-semibold">Diferença: ${brl(r.diferenca)}</div>` : ''}
      </div>
      <div style="min-width:32px;text-align:center;font-size:1.2rem">${r.ok ? '✅' : '❌'}</div>
    </div>`).join('')

  container.innerHTML = `
    <div class="card mb-4" style="border:1px solid ${bordaGeral};background:${corGeral}">
      <div class="card-body">
        <div class="d-flex align-items-center gap-3 mb-3">
          <div style="font-size:2rem">${tudoOk ? '✅' : '⚠️'}</div>
          <div>
            <div class="fw-bold fs-5">${tudoOk ? 'Nota em conformidade' : `${totalErros} divergência(s) encontrada(s)`}</div>
            <div class="text-muted small">${resultados.filter(r => r.ok).length} de ${resultados.length} itens corretos</div>
          </div>
        </div>
        <div class="row g-3 mb-3">
          <div class="col-6 col-md-3"><div class="small text-muted">Emitente</div><div class="fw-semibold small">${esc(dados.emitente || '-')}</div></div>
          <div class="col-6 col-md-3"><div class="small text-muted">NFS-e nº</div><div class="fw-semibold small">${esc(dados.numero_nfse || '-')}</div></div>
          <div class="col-6 col-md-3"><div class="small text-muted">Valor total</div><div class="fw-semibold small">${brl(dados.valor_total_declarado)}</div></div>
          <div class="col-6 col-md-3"><div class="small text-muted">Valor líquido</div><div class="fw-semibold small">${brl(dados.valor_liquido)}</div></div>
        </div>
        ${dados.faturas_referenciadas ? `<div class="small mb-3"><span class="text-muted">Faturas:</span> <span class="fw-semibold ms-1">${esc(dados.faturas_referenciadas)}</span></div>` : ''}
        <div class="mb-3">${linhas}</div>
        ${analise ? `<div class="p-3 rounded-3" style="background:rgba(0,0,0,.04);border-left:3px solid #ED3237"><div class="small fw-semibold mb-1">💬 Análise</div><div class="small">${esc(analise)}</div></div>` : ''}
      </div>
    </div>`

  historico.unshift({ emitente: dados.emitente || '-', numero: dados.numero_nfse || '-', valor: dados.valor_total_declarado || 0, tudoOk })
  renderizarHistorico()
}

function renderizarHistorico() {
  const container = $('historico-conferencias')
  if (!container || !historico.length) return
  container.innerHTML = `
    <h6 class="fw-bold mb-3">Conferências desta sessão</h6>
    ${historico.map(h => `
      <div class="card mb-2 ${h.tudoOk ? 'card-ok' : ''}">
        <div class="card-body py-2 d-flex justify-content-between align-items-center">
          <div><span class="fw-semibold small">${esc(h.emitente)}</span> <span class="text-muted small ms-2">NFS-e ${esc(h.numero)}</span></div>
          <div class="d-flex gap-2 align-items-center"><span class="small">${brl(h.valor)}</span><span>${h.tudoOk ? '✅' : '❌'}</span></div>
        </div>
      </div>`).join('')}`
}

async function processarArquivo(arquivo, aliquotaIssqn) {
  const areaResultado = $('resultado-conferencia')
  const btnConferir = $('btn-conferir')

  areaResultado.innerHTML = `
    <div class="card mb-4"><div class="card-body text-center py-5">
      <div class="spinner-border text-danger mb-3" role="status"></div>
      <div class="fw-semibold" id="status-msg">Extraindo texto do PDF...</div>
      <div class="text-muted small" id="status-sub">Aguarde um momento</div>
    </div></div>`

  btnConferir.disabled = true
  btnConferir.textContent = 'Processando...'

  try {
    const texto = await extrairTextoPdf(arquivo)
    if (!texto || texto.length < 50) throw new Error('Não foi possível extrair texto do PDF. Verifique se o arquivo não é uma imagem escaneada.')

    $('status-msg').textContent = 'Analisando com Gemini...'
    $('status-sub').textContent = 'Identificando os valores da nota'

    const dados = await extrairDadosNfse(texto, aliquotaIssqn)

    $('status-msg').textContent = 'Conferindo cálculos...'
    const resultados = conferirCalculos(dados, aliquotaIssqn)

    $('status-msg').textContent = 'Gerando análise...'
    const analise = await analisarComGemini(dados, resultados)

    renderizarResultado(dados, resultados, analise)
  } catch (erro) {
    areaResultado.innerHTML = `<div class="alert alert-danger"><strong>Erro:</strong> ${esc(erro.message)}</div>`
  } finally {
    btnConferir.disabled = false
    btnConferir.textContent = '🔍 Conferir NFS-e'
  }
}

function montar() {
  const container = $('conteudo-nfse')
  container.innerHTML = `
    <div class="card border-0 shadow-sm mb-4"><div class="card-body">
      <h5 class="fw-bold mb-1">Enviar NFS-e para conferência</h5>
      <p class="text-muted small mb-3">Faça upload do PDF da nota fiscal. O sistema extrai o texto, analisa com o Gemini e verifica automaticamente 1/12 avos, IRRF, ISSQN e valor líquido.</p>
      <div id="zona-upload" class="rounded-3 text-center p-5 mb-3" style="border:2px dashed #dee2e6;cursor:pointer;transition:border-color .2s" onclick="document.getElementById('input-pdf').click()">
        <div style="font-size:2.5rem">📄</div>
        <div class="fw-semibold mt-2">Clique para selecionar o PDF</div>
        <div class="text-muted small">ou arraste e solte aqui</div>
        <div id="nome-arquivo" class="mt-2 small text-danger fw-semibold"></div>
      </div>
      <input type="file" id="input-pdf" accept=".pdf" style="display:none">
      <div class="row g-3 mb-3">
        <div class="col-12 col-md-4">
          <label class="form-label fw-semibold small">Alíquota ISSQN esperada</label>
          <div class="input-group">
            <input type="number" id="aliquota-issqn" class="form-control" value="2.00" step="0.01" min="0" max="10">
            <span class="input-group-text">%</span>
          </div>
          <div class="form-text">Padrão: 2,00%. Ajuste se o município for diferente.</div>
        </div>
      </div>
      <button id="btn-conferir" class="btn btn-pietrobon w-100" disabled>🔍 Conferir NFS-e</button>
    </div></div>
    <div id="resultado-conferencia"></div>
    <div id="historico-conferencias" class="mt-2"></div>`

  const inputPdf = $('input-pdf')
  const zonaUpload = $('zona-upload')
  const nomeArquivo = $('nome-arquivo')
  const btnConferir = $('btn-conferir')
  let arquivoSelecionado = null

  const selecionarArquivo = (arquivo) => {
    if (!arquivo || arquivo.type !== 'application/pdf') { alert('Selecione um arquivo PDF válido.'); return }
    arquivoSelecionado = arquivo
    nomeArquivo.textContent = arquivo.name
    zonaUpload.style.borderColor = '#ED3237'
    btnConferir.disabled = false
  }

  inputPdf.addEventListener('change', (e) => { if (e.target.files[0]) selecionarArquivo(e.target.files[0]) })
  zonaUpload.addEventListener('dragover', (e) => { e.preventDefault(); zonaUpload.style.borderColor = '#ED3237' })
  zonaUpload.addEventListener('dragleave', () => { if (!arquivoSelecionado) zonaUpload.style.borderColor = '#dee2e6' })
  zonaUpload.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) selecionarArquivo(e.dataTransfer.files[0]) })

  btnConferir.addEventListener('click', () => {
    if (!arquivoSelecionado) return
    const aliq = parseFloat($('aliquota-issqn')?.value) || 2.0
    processarArquivo(arquivoSelecionado, aliq)
  })
}

async function iniciar() {
  const perfil = exigirPapel(['admin'])
  if (!perfil) return
  if (!EMAILS_PERMITIDOS.includes((perfil.email || '').toLowerCase())) {
    window.location.href = '/HTML/producao/admin.html'
    return
  }
  montarCabecalho(perfil.papel)
  montar()
}

iniciar()