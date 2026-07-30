import { api } from ''/JS/core/api.js''

const TITULOS_POR_PAPEL = {
  admin: ''Assistente Geral'',
  almoxarifado: ''Assistente do Almoxarifado'',
  compras: ''Assistente de Compras'',
  compras_aromas: ''Assistente de Aromas'',
  gerente_producao: ''Assistente de Embarques'',
  deposito: ''Assistente do Depósito'',
  convidado: ''Assistente''
}

const SUGESTOES_POR_PAPEL = {
  almoxarifado: [''O que ainda falta declarar?'', ''Quais PIs estão pendentes?''],
  compras: [''Tem pedidos pendentes pra mim?'', ''Alguma compra com entrega atrasada?''],
  compras_aromas: [''Tem pedido de aroma pra responder?''],
  gerente_producao: [''Quais PIs estão prontas sem data de embarque?''],
  admin: [''Resumo das pendências'', ''O que está atrasado hoje?''],
  deposito: [''O que preciso lançar no B2?''],
  convidado: [''Como funciona o sistema?'']
}

let historico = []
let painelAberto = false

export function iniciarChat(papel) {
  if (document.getElementById(''btn-chat'')) return

  const titulo = TITULOS_POR_PAPEL[papel] || ''Assistente''

  const estilo = document.createElement(''style'')
  estilo.textContent = `
    #btn-chat {
      position: fixed; right: 18px; bottom: 18px; z-index: 1050;
      width: 58px; height: 58px; border-radius: 50%;
      background: linear-gradient(135deg, #ED3237, #C6242A);
      color: #fff; border: none; font-size: 1.5rem; cursor: pointer;
      box-shadow: 0 6px 18px rgba(180, 20, 20, .4); transition: transform .15s;
    }
    #btn-chat:hover { transform: scale(1.07); }
    #painel-chat {
      position: fixed; right: 18px; bottom: 86px; z-index: 1050;
      width: 360px; max-width: calc(100vw - 24px);
      height: 520px; max-height: calc(100vh - 120px);
      background: #fff; border-radius: 16px; overflow: hidden;
      display: none; flex-direction: column;
      box-shadow: 0 12px 40px rgba(0, 0, 0, .25); border: 1px solid #f0d0d0;
    }
    #painel-chat.aberto { display: flex; }
    .chat-topo {
      background: linear-gradient(120deg, #ED3237, #C6242A);
      color: #fff; padding: 12px 16px; font-weight: 700;
      display: flex; align-items: center; justify-content: space-between;
    }
    .chat-topo small { display: block; font-weight: 400; opacity: .85; font-size: .72rem; }
    .chat-btn-fechar { background: none; border: none; color: #fff; font-size: 1.3rem; cursor: pointer; line-height: 1; }
    .chat-mensagens {
      flex: 1; overflow-y: auto; padding: 14px;
      background: #FDF1F1; display: flex; flex-direction: column; gap: 8px;
    }
    .chat-bolha {
      max-width: 82%; padding: 9px 12px; border-radius: 14px;
      font-size: .9rem; line-height: 1.4; white-space: pre-wrap; word-wrap: break-word;
    }
    .chat-bolha.usuario {
      align-self: flex-end; background: #ED3237; color: #fff; border-bottom-right-radius: 4px;
    }
    .chat-bolha.assistente {
      align-self: flex-start; background: #fff; color: #2E2E33;
      border: 1px solid #f0d0d0; border-bottom-left-radius: 4px;
    }
    .chat-sugestoes { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 14px 8px; background: #FDF1F1; }
    .chat-btn-sugestao {
      background: #fff; border: 1px solid #f0d0d0; color: #C6242A;
      border-radius: 16px; padding: 5px 10px; font-size: .78rem; cursor: pointer;
    }
    .chat-btn-sugestao:hover { background: #fff8f8; }
    .chat-rodape {
      display: flex; gap: 8px; padding: 10px;
      border-top: 1px solid #f0d0d0; background: #fff;
    }
    .chat-rodape input {
      flex: 1; border: 1px solid #e7d3d3; border-radius: 10px;
      padding: 9px 12px; font-size: .9rem; outline: none;
    }
    .chat-rodape input:focus { border-color: #ED3237; }
    .chat-rodape button {
      background: #2E7D32; color: #fff; border: none;
      border-radius: 10px; padding: 0 16px; font-weight: 700; cursor: pointer;
    }
    .chat-rodape button:disabled { opacity: .5; cursor: default; }
  `
  document.head.appendChild(estilo)

  const btnChat = document.createElement(''button'')
  btnChat.id = ''btn-chat''
  btnChat.title = titulo
  btnChat.textContent = ''💬''
  document.body.appendChild(btnChat)

  const sugestoes = (SUGESTOES_POR_PAPEL[papel] || SUGESTOES_POR_PAPEL.convidado)
    .map((s) => `<button class="chat-btn-sugestao" type="button">${s}</button>`)
    .join('''')

  const painel = document.createElement(''div'')
  painel.id = ''painel-chat''
  painel.innerHTML = `
    <div class="chat-topo">
      <div>${titulo}<small>Tire dúvidas sobre o sistema ou as pendências do seu setor</small></div>
      <button class="chat-btn-fechar" title="Fechar">×</button>
    </div>
    <div class="chat-mensagens" id="chat-mensagens"></div>
    <div class="chat-sugestoes" id="chat-sugestoes">${sugestoes}</div>
    <form class="chat-rodape" id="chat-form">
      <input type="text" id="chat-input" placeholder="Escreva sua pergunta..." autocomplete="off">
      <button type="submit" id="chat-btn-enviar">➤</button>
    </form>`
  document.body.appendChild(painel)

  const elMensagens = painel.querySelector(''#chat-mensagens'')
  const elInput = painel.querySelector(''#chat-input'')
  const btnEnviar = painel.querySelector(''#chat-btn-enviar'')

  function formatarTexto(texto) {
    return texto
      .replace(/&/g, ''&amp;'').replace(/</g, ''&lt;'').replace(/>/g, ''&gt;'')
      .replace(/\*\*(.+?)\*\*/g, ''<strong>$1</strong>'')
      .replace(/(^|\n)\s*[-*]\s+(.+)/g, ''$1• $2'')
      .replace(/\n/g, ''<br>'')
  }

  function adicionarBolha(texto, tipo) {
    const bolha = document.createElement(''div'')
    bolha.className = `chat-bolha ${tipo}`
    if (tipo === ''assistente'') bolha.innerHTML = formatarTexto(texto)
    else bolha.textContent = texto
    elMensagens.appendChild(bolha)
    elMensagens.scrollTop = elMensagens.scrollHeight
    return bolha
  }

  function abrirChat() {
    painelAberto = true
    painel.classList.add(''aberto'')
    if (!historico.length) {
      adicionarBolha(`Olá! Sou o ${titulo.toLowerCase()}. No que posso ajudar?`, ''assistente'')
    }
    elInput.focus()
  }

  function fecharChat() {
    painelAberto = false
    painel.classList.remove(''aberto'')
  }

  btnChat.addEventListener(''click'', () => (painelAberto ? fecharChat() : abrirChat()))
  painel.querySelector(''.chat-btn-fechar'').addEventListener(''click'', fecharChat)

  async function enviarMensagem(texto) {
    const msg = (texto || elInput.value).trim()
    if (!msg) return

    elInput.value = ''''
    adicionarBolha(msg, ''usuario'')
    historico.push({ de: ''user'', texto: msg })

    btnEnviar.disabled = true
    const aguardando = adicionarBolha(''digitando...'', ''assistente'')

    const resposta = await api.chat(msg, historico)
    aguardando.remove()

    const textoResposta = resposta?.resposta || resposta?.erro || ''Não consegui responder agora.''
    adicionarBolha(textoResposta, ''assistente'')
    historico.push({ de: ''bot'', texto: textoResposta })

    btnEnviar.disabled = false
    elInput.focus()
  }

  painel.querySelector(''#chat-form'').addEventListener(''submit'', (e) => {
    e.preventDefault()
    enviarMensagem()
  })

  painel.querySelectorAll(''.chat-btn-sugestao'').forEach((btn) => {
    btn.addEventListener(''click'', () => enviarMensagem(btn.textContent))
  })
}
