import { api } from '/JS/compartilhado/api.js'
import { $, iniciarPagina, brl, num, valorMoeda, dBR, esc, pill, MESES, avisar } from '/JS/financeiro/comum.js'

function kpi({ rotulo, valor, sub, cor, href }) {
  const tag = href ? 'a' : 'div'
  return `<${tag} class="kpi kpi-${cor}"${href ? ` href="${href}"` : ''}>
    <span class="kpi-rotulo">${rotulo}</span>
    <span class="kpi-valor">${valor}</span>
    ${sub ? `<span class="kpi-sub">${sub}</span>` : ''}
  </${tag}>`
}

function listaImportacoes(lista, vazio) {
  if (!lista.length) return `<div class="fin-vazio">${vazio}</div>`
  return `<ul class="fin-lista-alertas">${lista
    .map(
      (i) => `<li>
        <div><div class="texto-forte">${esc(i.invoice)}</div><div class="texto-sub">${esc(i.fornecedor_nome || '—')} · vence ${dBR(i.data_vencimento)}</div></div>
        <div class="text-end"><div class="texto-forte">${valorMoeda(i.saldo_moeda, i.moeda)}</div>
          ${
            i.prazo === 'VENCIDA'
              ? pill(`Vencida há ${Math.abs(i.dias_para_vencer)} d`, 'vencida')
              : pill(
                  i.dias_para_vencer === 0 ? 'Vence hoje' : `Em ${i.dias_para_vencer} d`,
                  i.dias_para_vencer <= 7 ? 'alerta' : 'neutro'
                )
          }</div>
      </li>`
    )
    .join('')}</ul>`
}

function grafico(porMes) {
  const max = Math.max(...porMes.map((m) => m.valor), 1)
  const mesAtual = new Date().getMonth() + 1
  return `<div class="fin-grafico">${porMes
    .map(
      (m) => `<div class="coluna" title="${MESES[m.mes - 1]}: ${brl(m.valor)} (${m.qtd} nota${m.qtd === 1 ? '' : 's'})">
        <div class="barra ${m.valor ? '' : 'vazia'} ${m.mes === mesAtual ? 'atual' : ''}" style="height:${Math.max(2, (m.valor / max) * 100)}%"></div>
        <span class="rotulo">${MESES[m.mes - 1].slice(0, 3)}</span>
      </div>`
    )
    .join('')}</div>`
}

function render(d) {
  const imp = d.importacoes
  const aPagar = imp.porMoeda.length
    ? imp.porMoeda.map((m) => valorMoeda(m.saldo, m.moeda)).join('<br>')
    : 'Nada em aberto'
  const pend = d.pendencias
  const itensPendencia = [
    [
      pend.importacoesSemVencimento,
      'importação(ões) em aberto sem data de vencimento',
      '/HTML/financeiro/importacoes.html'
    ],
    [
      pend.contratosALiquidar,
      'contrato(s) de câmbio ainda não liquidado(s)',
      '/HTML/financeiro/importacoes.html#contratos'
    ],
    [
      pend.notasSemCliente,
      `nota(s) de ${d.faturamento.ano} sem cliente vinculado (não entram no Fechamento)`,
      '/HTML/financeiro/mensal-contabil.html'
    ],
    [
      pend.notasIncompletas,
      `nota(s) de ${d.faturamento.ano} com campos faltando`,
      '/HTML/financeiro/mensal-contabil.html'
    ],
    [pend.pagoAMaior, 'importação(ões) com pagamento maior que o valor da invoice', '/HTML/financeiro/importacoes.html']
  ].filter(([q]) => q > 0)

  $('conteudo-painel').innerHTML = `
    <div class="fin-kpis">
      ${kpi({ rotulo: 'A pagar a fornecedores', valor: aPagar, sub: `${imp.qtdAbertas} importação(ões) · ≈ ${brl(imp.saldoReaisEstimado)}`, cor: 'azul', href: '/HTML/financeiro/importacoes.html' })}
      ${kpi({ rotulo: 'Importações vencidas', valor: String(imp.vencidas.length), sub: imp.vencidas.length ? 'Precisam de pagamento' : 'Nenhuma em atraso', cor: imp.vencidas.length ? 'vermelho' : 'verde', href: '/HTML/financeiro/importacoes.html#vencidas' })}
      ${kpi({ rotulo: 'A receber de clientes', valor: brl(d.clientes.aReceber), sub: 'Saldo de Clientes Exterior', cor: 'laranja', href: '/HTML/financeiro/fechamento-contabil.html' })}
      ${kpi({ rotulo: `Faturamento ${d.faturamento.ano}`, valor: brl(d.faturamento.totalAno), sub: `Mês atual: ${brl(d.faturamento.mesAtual)}`, cor: 'verde', href: '/HTML/financeiro/mensal-contabil.html' })}
    </div>

    <div class="row g-3">
      <div class="col-lg-7">
        <div class="fin-cartao">
          <div class="fin-cartao-cab"><h2>Vencimentos de importações</h2><a class="btn-icone" href="/HTML/financeiro/importacoes.html">Ver todas</a></div>
          <div class="fin-cartao-corpo">
            ${imp.vencidas.length ? `<div class="texto-sub fw-bold text-uppercase mb-1">Vencidas</div>${listaImportacoes(imp.vencidas, '')}` : ''}
            <div class="texto-sub fw-bold text-uppercase mb-1 ${imp.vencidas.length ? 'mt-3' : ''}">Próximos 30 dias</div>
            ${listaImportacoes(imp.proximas, 'Nenhum vencimento nos próximos 30 dias.')}
          </div>
        </div>
        <div class="fin-cartao">
          <div class="fin-cartao-cab"><h2>Faturamento por mês · ${d.faturamento.ano}</h2><span class="texto-sub">${num(d.faturamento.pesoAno, 0)} kg no ano</span></div>
          <div class="fin-cartao-corpo">${grafico(d.faturamento.porMes)}</div>
        </div>
      </div>
      <div class="col-lg-5">
        <div class="fin-cartao">
          <div class="fin-cartao-cab"><h2>O que precisa de atenção</h2></div>
          <div class="fin-cartao-corpo">
            ${
              itensPendencia.length
                ? `<ul class="fin-lista-alertas">${itensPendencia
                    .map(
                      ([q, t, href]) =>
                        `<li><a href="${href}" class="text-decoration-none text-reset">${pill(String(q), 'alerta')} <span class="ms-1">${t}</span></a></li>`
                    )
                    .join('')}</ul>`
                : '<div class="fin-vazio">Tudo em dia. 👍</div>'
            }
          </div>
        </div>
        <div class="fin-cartao">
          <div class="fin-cartao-cab"><h2>Maiores saldos a receber</h2><a class="btn-icone" href="/HTML/financeiro/fechamento-contabil.html">Fechamento</a></div>
          <div class="fin-cartao-corpo">
            ${
              d.clientes.devedores.length
                ? `<ul class="fin-lista-alertas">${d.clientes.devedores
                    .map(
                      (c) =>
                        `<li><div><div class="texto-forte">${esc(c.nome)}</div><div class="texto-sub">${esc(c.pais || '—')}</div></div><div class="texto-forte">${brl(c.saldo)}</div></li>`
                    )
                    .join('')}</ul>`
                : '<div class="fin-vazio">Nenhum saldo em aberto.</div>'
            }
          </div>
        </div>
        <div class="fin-cartao">
          <div class="fin-cartao-cab"><h2>Adiantamentos</h2></div>
          <div class="fin-cartao-corpo">
            <div class="fin-resumo-linha"><span>Recebidos de clientes</span><strong>${brl(d.clientes.adiantamentos)}</strong></div>
            <div class="fin-resumo-linha"><span>Pagos a fornecedores</span><strong>${brl(d.fornecedores.adiantamentos)}</strong></div>
            <div class="fin-resumo-linha"><span>Variação cambial das importações de ${d.faturamento.ano}</span><strong class="${imp.variacaoCambialAno > 0 ? 'valor-negativo' : 'valor-positivo'}">${brl(imp.variacaoCambialAno)}</strong></div>
            <div class="texto-sub mt-2">Variação positiva = pago em reais acima da taxa da invoice.</div>
          </div>
        </div>
        <div class="text-end"><button class="btn-icone" id="btn-resumo">Enviar resumo semanal por e-mail agora</button></div>
      </div>
    </div>`

  $('btn-resumo').addEventListener('click', async (e) => {
    e.target.disabled = true
    const r = await api.fin.enviarResumoSemanal()
    e.target.disabled = false
    avisar(r?.erro || 'Resumo enviado por e-mail.', r?.erro ? 'error' : 'success')
  })
}

async function iniciar() {
  if (!iniciarPagina()) return
  const hoje = new Date()
  $('painel-data').textContent =
    `Situação em ${hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}`
  const d = await api.fin.painel()
  if (!d || d.erro) {
    $('conteudo-painel').innerHTML = `<p class="text-danger">${esc(d?.erro || 'Erro ao carregar.')}</p>`
    return
  }
  render(d)
}

iniciar()
