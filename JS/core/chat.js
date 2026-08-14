import { api } from '/JS/core/api.js'

const SUGESTOES_POR_PAPEL = {
  almoxarifado: ['O que ainda falta declarar?', 'Quais PIs estão pendentes?', 'Resumo do estoque hoje'],
  compras:       ['Pedidos pendentes para mim?', 'Alguma compra atrasada?', 'Resumo das compras'],
  compras_aromas:['Pedidos de aroma pendentes?', 'Resumo dos pedidos de aroma'],
  gerente_producao: ['PIs prontas sem embarque?', 'Status dos embarques'],
  admin:         ['Resumo geral do dia', 'O que está atrasado?', 'Status das tarefas da equipe'],
  deposito:      ['O que precisa ser lançado no B2?', 'Entradas recentes'],
  auxiliar:      ['Minhas tarefas pendentes', 'Resumo da equipe hoje'],
  convidado:     ['Como funciona o sistema?', 'Quais PIs estão abertas?']
}

let historico    = []
let painelAberto = false

export function iniciarChat(papel) {
  if (document.getElementById('btn-chat')) return

  const sugestoes = (SUGESTOES_POR_PAPEL[papel] || SUGESTOES_POR_PAPEL.convidado)

  const estilo = document.createElement('style')
  estilo.textContent = `
    #btn-chat {
      position: fixed; right: 20px; bottom: 20px; z-index: 1050;
      width: 56px; height: 56px; border-radius: 50%;
      background: linear-gradient(135deg, #E8313A, #C12028);
      color: #fff; border: none; cursor: pointer;
      box-shadow: 0 6px 20px rgba(193,32,40,.45);
      transition: transform .15s, box-shadow .15s;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.4rem;
    }
    #btn-chat:hover { transform: scale(1.08); box-shadow: 0 8px 24px rgba(193,32,40,.55); }

    #painel-chat {
      position: fixed; right: 20px; bottom: 88px; z-index: 1050;
      width: 400px; max-width: calc(100vw - 24px);
      height: 560px; max-height: calc(100vh - 116px);
      background: #fff; border-radius: 20px; overflow: hidden;
      display: none; flex-direction: column;
      box-shadow: 0 16px 48px rgba(0,0,0,.22), 0 2px 8px rgba(0,0,0,.08);
      border: 1px solid #f0d4d4;
    }
    #painel-chat.aberto { display: flex; animation: chatSlide .2s ease; }

    @keyframes chatSlide {
      from { opacity: 0; transform: translateY(12px) scale(.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    .chat-topo {
      background: linear-gradient(120deg, #E8313A, #C12028);
      color: #fff; padding: 14px 16px 12px;
      display: flex; align-items: center; gap: 10px;
      flex-shrink: 0;
    }
    .chat-topo-icone {
      width: 34px; height: 34px; border-radius: 50%;
      background: rgba(255,255,255,.2); display: flex;
      align-items: center; justify-content: center; font-size: 1.1rem;
      flex-shrink: 0;
    }
    .chat-topo-info { flex: 1; }
    .chat-topo-titulo { font-weight: 700; font-size: .92rem; line-height: 1.2; }
    .chat-topo-sub { font-size: .7rem; opacity: .8; margin-top: 1px; }
    .chat-btn-fechar {
      background: rgba(255,255,255,.18); border: none; color: #fff;
      width: 28px; height: 28px; border-radius: 50%; cursor: pointer;
      display: flex; align-items: center; justify-content: center; font-size: 1rem;
      flex-shrink: 0; transition: background .12s;
    }
    .chat-btn-fechar:hover { background: rgba(255,255,255,.30); }

    .chat-mensagens {
      flex: 1; overflow-y: auto; padding: 14px 12px;
      background: #fdf8f8; display: flex; flex-direction: column; gap: 10px;
      scroll-behavior: smooth;
    }
    .chat-mensagens::-webkit-scrollbar { width: 4px; }
    .chat-mensagens::-webkit-scrollbar-thumb { background: #f0d0d0; border-radius: 99px; }

    .chat-bolha-wrap { display: flex; flex-direction: column; max-width: 86%; }
    .chat-bolha-wrap.usuario { align-self: flex-end; align-items: flex-end; }
    .chat-bolha-wrap.assistente { align-self: flex-start; align-items: flex-start; }

    .chat-bolha {
      padding: 10px 14px; border-radius: 16px;
      font-size: .875rem; line-height: 1.55; word-wrap: break-word;
    }
    .chat-bolha.usuario {
      background: #E8313A; color: #fff; border-bottom-right-radius: 4px;
    }
    .chat-bolha.assistente {
      background: #fff; color: #1c2230; border-bottom-left-radius: 4px;
      border: 1px solid #f0d4d4; box-shadow: 0 1px 3px rgba(0,0,0,.05);
    }
    .chat-bolha.assistente strong { color: #C12028; }
    .chat-bolha.assistente ul, .chat-bolha.assistente ol { padding-left: 18px; margin: 4px 0; }
    .chat-bolha.assistente li { margin: 2px 0; }
    .chat-bolha.digitando { opacity: .65; font-style: italic; }

    .chat-timestamp {
      font-size: .65rem; color: #94a3b8; margin-top: 3px; padding: 0 4px;
    }

    .chat-sugestoes {
      display: flex; flex-wrap: wrap; gap: 6px;
      padding: 10px 12px 6px; background: #fdf8f8; flex-shrink: 0;
      border-top: 1px solid #f7eaea;
    }
    .chat-btn-sugestao {
      background: #fff; border: 1px solid #f0d4d4; color: #C12028;
      border-radius: 999px; padding: 5px 12px; font-size: .78rem;
      cursor: pointer; font-family: inherit; font-weight: 500;
      transition: all .12s; white-space: nowrap;
    }
    .chat-btn-sugestao:hover { background: #fef2f2; border-color: #E8313A; }

    .chat-rodape {
      display: flex; gap: 8px; padding: 10px 12px;
      border-top: 1px solid #f0d4d4; background: #fff; flex-shrink: 0;
    }
    .chat-rodape input {
      flex: 1; border: 1.5px solid #e9d0d0; border-radius: 12px;
      padding: 9px 14px; font-size: .875rem; outline: none;
      font-family: inherit; color: #1c2230; background: #fdf8f8;
      transition: border-color .15s, background .15s;
    }
    .chat-rodape input:focus { border-color: #E8313A; background: #fff; }
    .chat-rodape input::placeholder { color: #c4a0a0; }
    .chat-btn-enviar {
      background: linear-gradient(135deg, #E8313A, #C12028);
      color: #fff; border: none; border-radius: 12px;
      width: 40px; height: 40px; cursor: pointer; font-size: 1.1rem;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; transition: opacity .15s, transform .12s;
    }
    .chat-btn-enviar:hover { opacity: .9; transform: scale(1.05); }
    .chat-btn-enviar:disabled { opacity: .4; cursor: default; transform: none; }

    @media (max-width: 480px) {
      #painel-chat { right: 8px; left: 8px; width: auto; }
      #btn-chat { right: 14px; bottom: 14px; }
    }
  `
  document.head.appendChild(estilo)

  const btnChat = document.createElement('button')
  btnChat.id    = 'btn-chat'
  btnChat.title = 'Assistente IA'
  btnChat.innerHTML = '✦'
  document.body.appendChild(btnChat)

  const painel = document.createElement('div')
  painel.id = 'painel-chat'
  painel.innerHTML = `
    <div class="chat-topo">
      <div class="chat-topo-icone">✦</div>
      <div class="chat-topo-info">
        <div class="chat-topo-titulo">Assistente IA · Pietrobon</div>
        <div class="chat-topo-sub">Acesso a todos os dados do sistema</div>
      </div>
      <button class="chat-btn-fechar" title="Fechar">✕</button>
    </div>
    <div class="chat-mensagens" id="chat-mensagens"></div>
    <div class="chat-sugestoes" id="chat-sugestoes">
      ${sugestoes.map(s => `<button class="chat-btn-sugestao">${s}</button>`).join('')}
    </div>
    <div class="chat-rodape">
      <input type="text" id="chat-input" placeholder="Pergunte sobre o sistema ou qualquer coisa..." autocomplete="off">
      <button class="chat-btn-enviar" id="chat-btn-enviar" type="button">➤</button>
    </div>`
  document.body.appendChild(painel)

  const elMensagens = painel.querySelector('#chat-mensagens')
  const elInput     = painel.querySelector('#chat-input')
  const btnEnviar   = painel.querySelector('#chat-btn-enviar')

  function agora() {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  function formatarMd(texto) {
    return texto
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code style="background:#f1f5f9;padding:1px 5px;border-radius:4px;font-size:.82em">$1</code>')
      .replace(/(^|\n)#{1,3} (.+)/g, '$1<strong>$2</strong>')
      .replace(/(^|\n)\s*[-•]\s+(.+)/g, '$1<li>$2</li>')
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>')
  }

  function adicionarBolha(texto, tipo, timestamp = true) {
    const wrap = document.createElement('div')
    wrap.className = `chat-bolha-wrap ${tipo}`

    const bolha = document.createElement('div')
    bolha.className = `chat-bolha ${tipo}`
    if (tipo === 'assistente') bolha.innerHTML = formatarMd(texto)
    else bolha.textContent = texto

    wrap.appendChild(bolha)
    if (timestamp) {
      const ts = document.createElement('div')
      ts.className = 'chat-timestamp'
      ts.textContent = agora()
      wrap.appendChild(ts)
    }

    elMensagens.appendChild(wrap)
    elMensagens.scrollTop = elMensagens.scrollHeight
    return bolha
  }

  function abrirChat() {
    painelAberto = true
    painel.classList.add('aberto')
    if (!historico.length) {
      adicionarBolha('Olá! Tenho acesso a todos os dados do sistema em tempo real — PIs, almoxarifado, compras, tarefas, embarques e mais. No que posso ajudar?', 'assistente')
    }
    setTimeout(() => elInput.focus(), 200)
  }

  function fecharChat() {
    painelAberto = false
    painel.classList.remove('aberto')
  }

  btnChat.addEventListener('click', () => painelAberto ? fecharChat() : abrirChat())
  painel.querySelector('.chat-btn-fechar').addEventListener('click', fecharChat)

  async function enviarMensagem(texto) {
    const msg = (texto || elInput.value).trim()
    if (!msg) return

    elInput.value = ''
    adicionarBolha(msg, 'usuario')
    historico.push({ de: 'user', texto: msg })

    const elSugestoes = painel.querySelector('#chat-sugestoes')
    if (elSugestoes) elSugestoes.style.display = 'none'

    btnEnviar.disabled = true
    const aguardando = adicionarBolha('●●●', 'assistente digitando', false)

    const resposta = await api.chat(msg, historico)
    aguardando.closest('.chat-bolha-wrap').remove()

    const textoResposta = resposta?.resposta || resposta?.erro || 'Não consegui responder agora.'
    adicionarBolha(textoResposta, 'assistente')
    historico.push({ de: 'bot', texto: textoResposta })

    btnEnviar.disabled = false
    elInput.focus()
  }

  elInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensagem() }
  })
  btnEnviar.addEventListener('click', () => enviarMensagem())
  painel.querySelectorAll('.chat-btn-sugestao').forEach(btn =>
    btn.addEventListener('click', () => enviarMensagem(btn.textContent))
  )
}