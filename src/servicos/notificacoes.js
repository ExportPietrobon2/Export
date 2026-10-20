const webpush = require('web-push')
const { banco } = require('../config/banco')

const CHAVE_PUBLICA_VAPID =
  process.env.VAPID_PUBLIC || 'BBKXW9q8UQm07c-duKRqEFyyXEbDwQz4AeXipuuTOsPpcKB9nn7wJmXgTHE68GhjxUZej0YsGln4Cafu61_0slE'

const CHAVE_PRIVADA_VAPID = process.env.VAPID_PRIVATE || 'APBGcOONkbNs6Bf0KNqNj-T9hJMsdVdUpxXKWg4JgF0'

webpush.setVapidDetails('mailto:export2@pietrobon.com.br', CHAVE_PUBLICA_VAPID, CHAVE_PRIVADA_VAPID)

async function garantirTabelaPush() {
  await banco.query(`CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY, usuario_id INT,
    endpoint TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_endpoint (endpoint(255)))`)
}

async function podeEnviarPush(chave) {
  try {
    await banco.query(`CREATE TABLE IF NOT EXISTS push_log (
      chave VARCHAR(80) PRIMARY KEY, data_ref DATE NOT NULL, contador TINYINT NOT NULL DEFAULT 0)`)
    const hoje = new Date().toISOString().slice(0, 10)
    const [[r]] = await banco.query('SELECT data_ref, contador FROM push_log WHERE chave = ?', [chave])
    if (r && new Date(r.data_ref).toISOString().slice(0, 10) === hoje) {
      if (r.contador >= 3) return false
      await banco.query('UPDATE push_log SET contador = contador + 1 WHERE chave = ?', [chave])
    } else {
      await banco.query(
        'INSERT INTO push_log (chave, data_ref, contador) VALUES (?, CURDATE(), 1) ON DUPLICATE KEY UPDATE data_ref = CURDATE(), contador = 1',
        [chave]
      )
    }
    return true
  } catch (e) {
    return true
  }
}

async function enviarPush(titulo, corpo, url, chave) {
  if (!(await podeEnviarPush(chave))) return
  try {
    await garantirTabelaPush()
    const [subs] = await banco.query('SELECT endpoint, p256dh, auth FROM push_subscriptions')
    const dadosToken = JSON.stringify({ titulo, corpo, url: url || '/' })
    await Promise.allSettled(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, dadosToken)
        } catch (e) {
          if (e.statusCode === 410 || e.statusCode === 404) {
            await banco.query('DELETE FROM push_subscriptions WHERE endpoint = ?', [s.endpoint])
          }
        }
      })
    )
  } catch (e) {
    console.error('Erro enviarPush:', e.message)
  }
}

const EMAIL_TESTE = process.env.EMAIL_TESTE || 'pietrobonexport2@gmail.com'

const MODO_TESTE = process.env.MODO_TESTE !== 'false'

const CHAVE_API_BREVO = process.env.BREVO_API_KEY

const EMAIL_REMETENTE = process.env.EMAIL_REMETENTE || 'export2@pietrobon.com.br'

if (!CHAVE_API_BREVO) console.warn('BREVO_API_KEY não configurada — e-mails não serão enviados.')

async function obterDestinatarios(papeis) {
  if (MODO_TESTE) return [EMAIL_TESTE]
  if (papeis && papeis.length) {
    const [rows] = await banco.query('SELECT email FROM usuarios WHERE papel IN (?) AND recebe_email = 1', [papeis])
    return rows.map((r) => r.email)
  }
  const [rows] = await banco.query('SELECT email FROM usuarios WHERE recebe_email = 1')
  return rows.map((r) => r.email)
}

async function podeEnviarHoje(chave) {
  try {
    await banco.query('CREATE TABLE IF NOT EXISTS notif_log (chave VARCHAR(60) PRIMARY KEY, ultima_data DATE)')
    const [[r]] = await banco.query('SELECT ultima_data FROM notif_log WHERE chave = ?', [chave])
    const hoje = new Date().toISOString().slice(0, 10)
    if (r && r.ultima_data && new Date(r.ultima_data).toISOString().slice(0, 10) === hoje) return false
    await banco.query(
      'INSERT INTO notif_log (chave, ultima_data) VALUES (?, CURDATE()) ON DUPLICATE KEY UPDATE ultima_data = CURDATE()',
      [chave]
    )
    return true
  } catch (e) {
    return true
  }
}

async function enviarEmail(assunto, corpo, papeis) {
  try {
    if (!CHAVE_API_BREVO) return
    const destinatarios = await obterDestinatarios(papeis)
    if (!destinatarios.length) return

    const html = `
 <div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:0 auto;"><div style="background:linear-gradient(120deg,#ED3237,#C6242A);padding:24px 28px;border-radius:12px 12px 0 0;"><p style="color:#fff;font-size:1.2rem;font-weight:800;margin:0;">Hub de Exportações Pietrobon</p></div><div style="background:#fff;padding:28px;border:1px solid #f0d0d0;border-top:none;border-radius:0 0 12px 12px;">
 ${corpo}
 <hr style="border:none;border-top:1px solid #f0d0d0;margin:24px 0;"><p style="font-size:0.78rem;color:#8a6a6a;margin:0;">Pietrobon & Cia Ltda · Hub de Exportações Pietrobon<br>
 ${MODO_TESTE ? '<strong style="color:#ED3237">Modo teste — notificação enviada apenas para ' + EMAIL_TESTE + '</strong>' : ''}</p></div></div>`

    const resposta = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': CHAVE_API_BREVO, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: EMAIL_REMETENTE, name: 'Hub de Exportações Pietrobon' },
        to: destinatarios.map((email) => ({ email })),
        subject: assunto,
        htmlContent: html
      })
    })

    if (!resposta.ok) {
      const txt = await resposta.text()
      console.error('Erro Brevo:', resposta.status, txt)
    } else {
      console.log('Email enviado:', assunto)
    }
  } catch (e) {
    console.error('Erro ao enviar email:', e.message)
  }
}

async function enviarEmailPara(assunto, corpo, emails) {
  try {
    if (!CHAVE_API_BREVO) return
    const destinatarios = MODO_TESTE ? [EMAIL_TESTE] : (emails || []).filter(Boolean)
    if (!destinatarios.length) return
    const html = `
 <div style="font-family:'Segoe UI',sans-serif;max-width:640px;margin:0 auto;"><div style="background:linear-gradient(120deg,#ED3237,#C6242A);padding:24px 28px;border-radius:12px 12px 0 0;"><p style="color:#fff;font-size:1.2rem;font-weight:800;margin:0;">Hub de Exportações Pietrobon</p></div><div style="background:#fff;padding:28px;border:1px solid #f0d0d0;border-top:none;border-radius:0 0 12px 12px;">
 ${corpo}
 <hr style="border:none;border-top:1px solid #f0d0d0;margin:24px 0;"><p style="font-size:0.78rem;color:#8a6a6a;margin:0;">Pietrobon & Cia Ltda · Hub de Exportações Pietrobon<br>
 ${MODO_TESTE ? '<strong style="color:#ED3237">Modo teste — enviado apenas para ' + EMAIL_TESTE + '</strong>' : ''}</p></div></div>`
    const resposta = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': CHAVE_API_BREVO, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: EMAIL_REMETENTE, name: 'Hub de Exportações Pietrobon' },
        to: destinatarios.map((email) => ({ email })),
        subject: assunto,
        htmlContent: html
      })
    })
    if (!resposta.ok) {
      const txt = await resposta.text()
      console.error('Erro Brevo:', resposta.status, txt)
    } else {
      console.log('Email enviado:', assunto)
    }
  } catch (e) {
    console.error('Erro ao enviar email:', e.message)
  }
}

module.exports = { CHAVE_PUBLICA_VAPID, enviarEmail, enviarEmailPara, enviarPush, garantirTabelaPush, podeEnviarHoje }
