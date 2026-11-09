import { exigirPapel } from '/JS/compartilhado/sessao.js'
import { montarCabecalho } from '/JS/compartilhado/cabecalho.js'

export const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro'
]

export const $ = (id) => document.getElementById(id)

export function iniciarPagina() {
  const perfil = exigirPapel()
  if (!perfil) return null
  montarCabecalho()
  return perfil
}

export const num = (n, d = 2) =>
  (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })

export const brl = (n) => 'R$ ' + num(n)

export const valorMoeda = (n, moeda) => `${moeda || 'USD'} ${num(n)}`

export const dISO = (v) => (v ? String(v).slice(0, 10) : '')

export const dBR = (v) => {
  const s = dISO(v)
  return s ? s.split('-').reverse().join('/') : '—'
}

export const hojeISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export const normalizar = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

export function pill(texto, tipo, titulo) {
  return `<span class="pill pill-${tipo}"${titulo ? ` title="${esc(titulo)}"` : ''}>${esc(texto)}</span>`
}

const STATUS_IMPORTACAO = {
  EM_ABERTO: ['Em aberto', 'aberto'],
  PARCIAL: ['Pago parcial', 'parcial'],
  QUITADA: ['Quitada', 'quitada'],
  PAGO_A_MAIOR: ['Pago a maior', 'maior']
}

export function pillStatusImportacao(i) {
  const [texto, tipo] = STATUS_IMPORTACAO[i.status] || [i.status, 'neutro']
  return pill(texto, tipo)
}

export function pillPrazo(i) {
  if (i.prazo === 'VENCIDA') {
    const d = Math.abs(i.dias_para_vencer)
    return pill(`Vencida há ${d} dia${d === 1 ? '' : 's'}`, 'vencida')
  }
  if (i.prazo === 'VENCE_EM_BREVE') {
    const d = i.dias_para_vencer
    return pill(d === 0 ? 'Vence hoje' : `Vence em ${d} dia${d === 1 ? '' : 's'}`, 'alerta')
  }
  if (i.prazo === 'EM_DIA') return pill(`Vence ${dBR(i.data_vencimento)}`, 'neutro')
  if (i.prazo === 'SEM_VENCIMENTO')
    return pill('Sem vencimento', 'neutro', 'Informe a data de vencimento para receber alertas')
  return ''
}

export function barraProgresso(i) {
  const classe = i.prazo === 'VENCIDA' ? 'vencida' : i.status === 'PARCIAL' ? 'parcial' : ''
  return `<div class="progresso ${classe}" title="${num(i.percentual_pago, 0)}% pago"><span style="width:${Math.max(0, Math.min(100, Number(i.percentual_pago) || 0))}%"></span></div>`
}

export function numeroDoCampo(valor) {
  const s = String(valor ?? '').trim()
  if (!s) return 0
  if (s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
  return parseFloat(s) || 0
}

export function avisar(msg, tipo = 'success') {
  if (window.toast && window.toast[tipo]) window.toast[tipo](msg)
  else window.alert(msg)
}

export function painelLateral(id, titulo) {
  let el = document.getElementById(id)
  if (!el) {
    el = document.createElement('div')
    el.className = 'offcanvas offcanvas-end fin-painel no-recolher'
    el.id = id
    el.tabIndex = -1
    el.innerHTML = `<div class="offcanvas-header"><h5 class="offcanvas-title fw-bold mb-0"></h5>
      <button type="button" class="btn-close" data-bs-dismiss="offcanvas"></button></div>
      <div class="offcanvas-body"></div>`
    document.body.appendChild(el)
  }
  el.querySelector('.offcanvas-title').textContent = titulo
  const instancia = bootstrap.Offcanvas.getOrCreateInstance(el)
  return {
    corpo: el.querySelector('.offcanvas-body'),
    abrir: () => instancia.show(),
    fechar: () => instancia.hide(),
    titulo: (t) => {
      el.querySelector('.offcanvas-title').textContent = t
    }
  }
}

export async function buscarPtax(data) {
  const { api } = await import('/JS/compartilhado/api.js')
  if (!data) return null
  const r = await api.fin.ptax(data)
  return r && !r.erro && r.taxa != null ? r : null
}
