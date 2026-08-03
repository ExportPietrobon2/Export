import { exigirPapel } from '/JS/core/auth.js'
import { montarCabecalho } from '/JS/core/cabecalho.js'

const EMAILS_PERMITIDOS = ['export2@pietrobon.com.br', 'export@pietrobon.com.br', 'joaoantonio@pietrobon.com.br']
const ALIQUOTA_IRRF = 0.015
const ALIQUOTA_ISSQN = 0.02
const DIVISOR_DOZE_AVOS = 12
const TOLERANCIA = 0.05

const $ = (id) => document.getElementById(id)
const brl = (n) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

let historico = []

function obterToken() {
  return sessionStorage.getItem('token') || localStorage.getItem('token_deposito')
}

async function lerPdfComoBase64(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onload = () => resolve(leitor.result.split(',')[1])
    leitor.onerror = () => reject(new Error('Erro ao ler o arquivo'))
    leitor.readAsDataURL(arquivo)
  })
}

async function extrairDadosNfse(base64Pdf) {
  const prompt = `Você é um especialista em notas fiscais de serviço eletrônicas (NFS-e) brasileiras.
Analise o PDF desta NFS-e e extraia EXATAMENTE os seguintes campos em formato JSON.
Retorne SOMENTE o JSON, sem texto antes ou depois, sem markdown, sem explicações.

{
  "numero_nfse": "número da NFS-e",
  "emitente": "nome do emitente",
  "tomador": "nome do tomador",
  "descricao_servico": "descrição completa do serviço",
  "valor_servico": 0.00,
  "valor_comissao": 0.00,
  "valor_doze_avos": 0.00,
  "valor_total_declarado": 0.00,
  "irrf_declarado": 0.00,
  "issqn_declarado": 0.00,
  "valor_liquido": 0.00,
  "aliquota_issqn": 0.00,
  "faturas_referenciadas": "texto das faturas mencionadas"
}

Campos numéricos devem ser números (não strings). Use ponto como separador decimal.
Se algum campo não existir na nota, use null.`

  const resposta = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Pdf } },
          { type: 'text', text: prompt }
        ]
      }]
    })
  })

  const dados = await resposta.json()
  const texto = dados.content?.[0]?.text || ''

  try {
    return JSON.parse(texto.replace(/```json|```/g, '').trim())
  } catch (_) {
    throw new Error('Não foi possível extrair os dados da nota. Verifique se o PDF é uma NFS-e válida.')
  }
}

function conferirCalculos(dados) {
  const resultados = []

  const valorBase = Number(dados.valor_comissao) || Number(dados.valor_servico) || 0
  const dozeAvosDeclarado = Number(dados.valor_doze_avos) || 0
  const dozeAvosEsperado = valorBase / DIVISOR_DOZE_AVOS
  const totalDeclarado = Number(dados.valor_total_declarado) || Number(dados.valor_servico) || 0
  const totalEsperado = valorBase + dozeAvosEsperado
  const irrfDeclarado = Number(dados.irrf_declarado) || 0
  const irrfEsperado = totalDeclarado * ALIQUOTA_IRRF
  const issqnDeclarado = Number(dados.issqn_declarado) || 0
  const issqnEsperado = totalDeclarado * ALIQUOTA_ISSQN
  const valorLiquido = Number(dados.valor_liquido) || 0
  const liquidoEsperado = totalDeclarado - irrfDeclarado

  const verificar = (rotulo, declarado, esperado, detalhe) => {
    const diferenca = Math.abs(declarado - esperado)
    const ok = diferenca <= TOLERANCIA
    resultados.push({ rotulo, declarado, esperado, ok, diferenca, detalhe })
  }

  verificar(
    '1/12 avos',
    dozeAvosDeclarado,
    dozeAvosEsperado,
    `Comissão (${brl(valorBase)}) ÷ 12`
  )

  verificar(
    'Total da NFS-e (comissão + 1/12)',
    totalDeclarado,
    totalEsperado,
    `${brl(valorBase)} + ${brl(dozeAvosEsperado)}`
  )

  verificar(
    'IRRF retido (1,5%)',
    irrfDeclarado,
    irrfEsperado,
    `${brl(totalDeclarado)} × 1,5%`
  )

  verificar(
    'ISSQN (2,00%)',
    issqnDeclarado,
    issqnEsperado,
    `${brl(totalDeclarado)} × 2,0%`
  )

  verificar(
    'Valor líquido da NFS-e',
    valorLiquido,
    liquidoEsperado,
    `${brl(totalDeclarado)} − IRRF ${brl(irrfDeclarado)}`
  )

  return resultados
}

async function analisarComGemini(dados, resultados) {
  const pendencias = resultados.filter(r => !r.ok)
  const prompt = pendencias.length === 0
    ? `Esta NFS-e de comissão foi conferida e todos os cálculos estão corretos. Emitente: ${dados.emitente}. Tomador: ${dados.tomador}. Valor total: R$ ${dados.valor_total_declarado}. Dê uma confirmação breve e profissional em 2 linhas.`
    : `Esta NFS-e de comissão tem ${pendencias.length} divergência(s):
${pendencias.map(p => `- ${p.rotulo}: declarado ${brl(p.declarado)}, esperado ${brl(p.esperado)} (diferença de ${brl(p.diferenca)})`).join('\n')}
Emitente: ${dados.emitente}. Descreva o problema de forma clara e objetiva em até 4 linhas, sem usar linguagem técnica excessiva.`

  const token = obterToken()
  const resposta = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ mensagem: prompt, historico: [] })
  })

  const json = await resposta.json()
  return json.resposta || ''
}

function renderizarResultado(dados, resultados, analiseGemini) {
  const container = $('resultado-conferencia')
  if (!container) return

  const totalOk = resultados.filter(r => r.ok).length
  const totalErros = resultados.filter(r => !r.ok).length
  const tudoOk = totalErros === 0

  const corGeral = tudoOk ? '#e9f7ef' : '#fff8f0'
  const bordaGeral = tudoOk ? '#a8d5b5' : '#f5c6a0'
  const iconeGeral = tudoOk ? '✅' : '⚠️'
  const tituloGeral = tudoOk ? 'Nota em conformidade' : `${totalErros} divergência(s) encontrada(s)`

  const linhasResultado = resultados.map(r => `
    <div class="d-flex justify-content-between align-items-start py-2 border-bottom gap-3">
      <div>
        <div class="fw-semibold small">${esc(r.rotulo)}</div>
        <div class="text-muted" style="font-size:.78rem">${esc(r.detalhe)}</div>
      </div>
      <div class="text-end" style="min-width:200px">
        <div class="small">
          <span class="text-muted">Declarado:</span>
          <strong>${brl(r.declarado)}</strong>
        </div>
        <div class="small">
          <span class="text-muted">Esperado:</span>
          <strong>${brl(r.esperado)}</strong>
        </div>
        ${!r.ok ? `<div class="text-danger small fw-semibold">Diferença: ${brl(r.diferenca)}</div>` : ''}
      </div>
      <div style="min-width:32px;text-align:center;font-size:1.2rem">${r.ok ? '✅' : '❌'}</div>
    </div>`).join('')

  container.innerHTML = `
    <div class="card mb-4" style="border:1px solid ${bordaGeral};background:${corGeral}">
      <div class="card-body">
        <div class="d-flex align-items-center gap-3 mb-3">
          <div style="font-size:2rem">${iconeGeral}</div>
          <div>
            <div class="fw-bold fs-5">${tituloGeral}</div>
            <div class="text-muted small">${totalOk} de ${resultados.length} itens conferidos corretamente</div>
          </div>
        </div>

        <div class="row g-3 mb-3">
          <div class="col-6 col-md-3">
            <div class="small text-muted">Emitente</div>
            <div class="fw-semibold small">${esc(dados.emitente || '-')}</div>
          </div>
          <div class="col-6 col-md-3">
            <div class="small text-muted">NFS-e nº</div>
            <div class="fw-semibold small">${esc(dados.numero_nfse || '-')}</div>
          </div>
          <div class="col-6 col-md-3">
            <div class="small text-muted">Valor total</div>
            <div class="fw-semibold small">${brl(dados.valor_total_declarado)}</div>
          </div>
          <div class="col-6 col-md-3">
            <div class="small text-muted">Valor líquido</div>
            <div class="fw-semibold small">${brl(dados.valor_liquido)}</div>
          </div>
        </div>

        ${dados.faturas_referenciadas ? `
          <div class="small mb-3">
            <span class="text-muted">Faturas referenciadas:</span>
            <span class="fw-semibold ms-1">${esc(dados.faturas_referenciadas)}</span>
          </div>` : ''}

        <div class="mb-3">${linhasResultado}</div>

        ${analiseGemini ? `
          <div class="p-3 rounded-3" style="background:rgba(0,0,0,.04);border-left:3px solid #ED3237">
            <div class="small fw-semibold mb-1">💬 Análise</div>
            <div class="small">${esc(analiseGemini)}</div>
          </div>` : ''}
      </div>
    </div>`
}

function renderizarHistorico() {
  const container = $('historico-conferencias')
  if (!container || !historico.length) return

  container.innerHTML = `
    <h6 class="fw-bold mb-3">Conferências desta sessão</h6>
    ${historico.map((h, i) => `
      <div class="card mb-2 ${h.tudoOk ? 'card-ok' : ''}">
        <div class="card-body py-2">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <span class="fw-semibold small">${esc(h.emitente)}</span>
              <span class="text-muted small ms-2">NFS-e ${esc(h.numero)}</span>
            </div>
            <div class="d-flex align-items-center gap-2">
              <span class="small">${brl(h.valor)}</span>
              <span>${h.tudoOk ? '✅' : '❌'}</span>
            </div>
          </div>
        </div>
      </div>`).join('')}`
}

async function processarArquivo(arquivo) {
  const areaResultado = $('resultado-conferencia')
  const btnConferir = $('btn-conferir')

  areaResultado.innerHTML = `
    <div class="card mb-4">
      <div class="card-body text-center py-5">
        <div class="spinner-border text-danger mb-3" role="status"></div>
        <div class="fw-semibold">Lendo a NFS-e...</div>
        <div class="text-muted small">O Gemini está extraindo os dados do PDF</div>
      </div>
    </div>`

  btnConferir.disabled = true
  btnConferir.textContent = 'Processando...'

  try {
    const base64 = await lerPdfComoBase64(arquivo)

    areaResultado.querySelector('.fw-semibold').textContent = 'Conferindo os cálculos...'
    areaResultado.querySelector('.text-muted').textContent = 'Verificando IRRF, ISSQN, 1/12 avos e total'

    const dados = await extrairDadosNfse(base64)
    const resultados = conferirCalculos(dados)
    const tudoOk = resultados.every(r => r.ok)

    areaResultado.querySelector('.fw-semibold').textContent = 'Gerando análise...'
    const analise = await analisarComGemini(dados, resultados)

    historico.unshift({
      emitente: dados.emitente || '-',
      numero: dados.numero_nfse || '-',
      valor: dados.valor_total_declarado || 0,
      tudoOk
    })

    renderizarResultado(dados, resultados, analise)
    renderizarHistorico()

  } catch (erro) {
    areaResultado.innerHTML = `
      <div class="alert alert-danger">
        <strong>Erro ao processar a nota:</strong> ${esc(erro.message)}
      </div>`
  } finally {
    btnConferir.disabled = false
    btnConferir.textContent = '🔍 Conferir NFS-e'
  }
}

function montar() {
  const container = $('conteudo-nfse')
  container.innerHTML = `
    <div class="card border-0 shadow-sm mb-4">
      <div class="card-body">
        <h5 class="fw-bold mb-1">Enviar NFS-e para conferência</h5>
        <p class="text-muted small mb-3">Faça upload do PDF da nota fiscal. O sistema verifica automaticamente os cálculos de 1/12 avos, IRRF, ISSQN e valor líquido.</p>

        <div id="zona-upload" class="rounded-3 text-center p-5 mb-3"
          style="border:2px dashed #dee2e6;cursor:pointer;transition:border-color .2s"
          onclick="document.getElementById('input-pdf').click()">
          <div style="font-size:2.5rem">📄</div>
          <div class="fw-semibold mt-2">Clique para selecionar o PDF</div>
          <div class="text-muted small">ou arraste e solte aqui</div>
          <div id="nome-arquivo" class="mt-2 small text-danger fw-semibold"></div>
        </div>

        <input type="file" id="input-pdf" accept=".pdf" style="display:none">

        <div class="row g-3 mb-3">
          <div class="col-12 col-md-6">
            <label class="form-label fw-semibold small">Alíquota ISSQN esperada</label>
            <div class="input-group">
              <input type="number" id="aliquota-issqn" class="form-control" value="2.00" step="0.01" min="0" max="10">
              <span class="input-group-text">%</span>
            </div>
            <div class="form-text">Padrão: 2,00%. Ajuste se o município da nota for diferente.</div>
          </div>
        </div>

        <button id="btn-conferir" class="btn btn-pietrobon w-100" disabled>
          🔍 Conferir NFS-e
        </button>
      </div>
    </div>

    <div id="resultado-conferencia"></div>
    <div id="historico-conferencias" class="mt-2"></div>`

  const inputPdf = $('input-pdf')
  const zonaUpload = $('zona-upload')
  const nomeArquivo = $('nome-arquivo')
  const btnConferir = $('btn-conferir')
  let arquivoSelecionado = null

  const selecionarArquivo = (arquivo) => {
    if (!arquivo || arquivo.type !== 'application/pdf') {
      alert('Selecione um arquivo PDF válido.')
      return
    }
    arquivoSelecionado = arquivo
    nomeArquivo.textContent = arquivo.name
    zonaUpload.style.borderColor = '#ED3237'
    btnConferir.disabled = false
  }

  inputPdf.addEventListener('change', (e) => {
    if (e.target.files[0]) selecionarArquivo(e.target.files[0])
  })

  zonaUpload.addEventListener('dragover', (e) => {
    e.preventDefault()
    zonaUpload.style.borderColor = '#ED3237'
  })

  zonaUpload.addEventListener('dragleave', () => {
    if (!arquivoSelecionado) zonaUpload.style.borderColor = '#dee2e6'
  })

  zonaUpload.addEventListener('drop', (e) => {
    e.preventDefault()
    const arquivo = e.dataTransfer.files[0]
    if (arquivo) selecionarArquivo(arquivo)
  })

  btnConferir.addEventListener('click', () => {
    if (arquivoSelecionado) processarArquivo(arquivoSelecionado)
  })
}

async function iniciar() {
  const perfil = exigirPapel(['admin'])
  if (!perfil) return

  const email = (perfil.email || '').toLowerCase()
  if (!EMAILS_PERMITIDOS.includes(email)) {
    window.location.href = '/HTML/producao/admin.html'
    return
  }

  montarCabecalho(perfil.papel)
  montar()
}

iniciar()