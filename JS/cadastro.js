import { api } from './api.js'
import { TIPOS_INSUMO, formatarQuantidade } from './constants.js'
import { exigirPapel } from './auth.js'
import { montarCabecalho } from './cabecalho.js'

const selectPiDoProduto = document.getElementById('pi-do-produto')
const listaPedidos = document.getElementById('lista-pedidos')

async function carregarPedidos() {
  const pedidos = await api.pedidos.listar()
  if (!pedidos) return

  selectPiDoProduto.innerHTML = '<option value="">Selecione o PI</option>'
  listaPedidos.innerHTML = ''

  for (const pedido of pedidos) {
    const opcao = document.createElement('option')
    opcao.value = pedido.id
    opcao.textContent = `PI ${pedido.numero_pi}${pedido.cliente ? ' — ' + pedido.cliente : ''}`
    selectPiDoProduto.appendChild(opcao)

    const produtos = await api.produtos.listar(pedido.id)
    const bloco = document.createElement('div')
    bloco.className = 'pi-resumo'

    const cabecalhoPi = document.createElement('div')
    cabecalhoPi.className = 'pi-resumo-cabecalho'

    const titulo = document.createElement('strong')
    titulo.textContent = `PI ${pedido.numero_pi}`
    cabecalhoPi.appendChild(titulo)

    const botaoExcluir = document.createElement('button')
    botaoExcluir.type = 'button'
    botaoExcluir.className = 'btn-excluir'
    botaoExcluir.textContent = 'Excluir PI'
    botaoExcluir.addEventListener('click', () => excluirPi(pedido.id, pedido.numero_pi))
    cabecalhoPi.appendChild(botaoExcluir)

    bloco.appendChild(cabecalhoPi)
    bloco.appendChild(document.createTextNode(` ${pedido.cliente || 'sem cliente'} — ${pedido.destino || 'sem destino'}`))

    const lista = document.createElement('ul')
    if (!produtos || produtos.length === 0) {
      const item = document.createElement('li')
      item.className = 'sem-produtos'
      item.textContent = 'Nenhum produto cadastrado ainda.'
      lista.appendChild(item)
    } else {
      produtos.forEach((produto) => {
        const item = document.createElement('li')
        item.textContent = `${produto.produto} — ${formatarQuantidade(produto.quantidade)}`
        lista.appendChild(item)
      })
    }
    bloco.appendChild(lista)
    listaPedidos.appendChild(bloco)
  }
}

async function excluirPi(piId, numeroPi) {
  if (!confirm(`Excluir o PI ${numeroPi}? Isso remove também os produtos, insumos e recebimentos. Não pode ser desfeito.`)) return
  await api.pedidos.excluir(piId)
  carregarPedidos()
}

document.getElementById('form-novo-pi').addEventListener('submit', async (evento) => {
  evento.preventDefault()
  const numeroPi = document.getElementById('numero-pi').value.trim()
  if (!numeroPi) return

  const resultado = await api.pedidos.criar({
    numero_pi: numeroPi,
    data_embarque: document.getElementById('data-embarque').value || null,
    cliente: document.getElementById('cliente-pi').value.trim() || null,
    destino: document.getElementById('destino-pi').value.trim() || null
  })

  if (resultado?.erro) { alert('Erro ao cadastrar PI.'); return }
  evento.target.reset()
  carregarPedidos()
})

document.getElementById('form-novo-produto').addEventListener('submit', async (evento) => {
  evento.preventDefault()
  const piId = selectPiDoProduto.value
  const produto = document.getElementById('nome-produto').value.trim()
  const quantidade = document.getElementById('quantidade-produto').value
  if (!piId || !produto || !quantidade) return

  const resultado = await api.produtos.criar({
    pi_id: piId,
    produto,
    quantidade,
    observacoes: document.getElementById('observacoes-produto').value.trim() || null
  })

  if (resultado?.erro) { alert('Erro ao cadastrar produto.'); return }
  const piSelecionado = piId
  evento.target.reset()
  selectPiDoProduto.value = piSelecionado
  carregarPedidos()
})

async function iniciar() {
  const perfil = exigirPapel(['admin'])
  if (!perfil) return
  montarCabecalho(perfil.papel)
  carregarPedidos()
}

iniciar()