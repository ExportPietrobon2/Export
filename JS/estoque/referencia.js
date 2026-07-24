import { exigirPapel } from '/JS/core/auth.js'
import { montarCabecalho } from '/JS/core/cabecalho.js'

const DADOS = [
 {
 categoria: 'Rótulos',
 itens: [
 { produto: 'Bala Mastigável 2,8g — Rótulo 55mm', pesoPct: '25,41 g', rendimento: '39,35 kg de bala por kg de rótulo' },
 { produto: 'Bala Mastigável 2,8g — Rótulo 65mm', pesoPct: '33,92 g', rendimento: '30 kg de bala por kg de rótulo' },
 { produto: 'Bala Mastigável 4,7g — Rótulo 65mm', pesoPct: '24,74 g', rendimento: '48,83 kg de bala por kg de rótulo' },
 { produto: 'Bala Dura 6,5g', pesoPct: '21,20 g', rendimento: '47,1 kg de bala por kg de rótulo' },
 { produto: 'Bala Sabor Tropical 6,5g', pesoPct: '21,20 g', rendimento: '47,1 kg de bala por kg de rótulo' },
 { produto: 'Pirulito Bola 20g', pesoPct: '15,00 g', rendimento: '66 kg de pirulito por kg de rótulo' },
 { produto: 'Pirulito Bola 20g Uva', pesoPct: '16,56 g', rendimento: '60 kg de pirulito por kg de rótulo' },
 { produto: 'Pirulito Plano 9g Fan Pop Laranja', pesoPct: '8,67 g', rendimento: '115 kg de pirulito por kg de rótulo' },
 { produto: 'Forro Pirulito Plano 9g (30 micras)', pesoPct: '9,88 g', rendimento: '101 kg de pirulito por kg de forro' },
 ]
 },
 {
 categoria: 'Embalagem Bala KG',
 itens: [
 { produto: 'Bala KG Menta', pesoPct: '8,76 g' },
 { produto: 'Bala Mix 500', pesoPct: '13,35 g' },
 ]
 },
 {
 categoria: 'Embalagem Bala 600g',
 itens: [
 { produto: 'Bala 600g Yogurte Sortida', pesoPct: '7,35 g' },
 { produto: 'Bala 600g Yogurte Morango', pesoPct: '7,99 g' },
 { produto: 'Bala 600g Yogurte Uva', pesoPct: '7,70 g' },
 { produto: 'Bala 600g Piteco Frutas', pesoPct: '7,91 g' },
 { produto: 'Bala 600g Framboesa Mast.', pesoPct: '7,56 g' },
 { produto: 'Bala 600g Tutti Frutti', pesoPct: '7,50 g' },
 { produto: 'Bala 600g Yogurte Morango (v2)', pesoPct: '7,97 g' },
 { produto: 'Bala 600g Toffee', pesoPct: '8,16 g' },
 { produto: 'Bala 600g Menta Mastigável', pesoPct: '7,81 g' },
 { produto: 'Bala 600g Caramelo Castanha', pesoPct: '8,05 g' },
 { produto: 'Bala 600g Frutalli', pesoPct: '7,46 g' },
 { produto: 'Bala 600g Super Fresh Sortida', pesoPct: '6,26 g' },
 { produto: 'Bala 600g Hortelã', pesoPct: '6,90 g' },
 { produto: 'Bala 600g Canela', pesoPct: '6,16 g' },
 { produto: 'Bala 600g Cola', pesoPct: '8,22 g' },
 { produto: 'Bala 600g Mel', pesoPct: '7,52 g' },
 { produto: 'Bala 600g Happy Mix', pesoPct: '8,22 g' },
 { produto: 'Bala 600g Sortidas Tropicais', pesoPct: '7,15 g' },
 { produto: 'Bala 600g Algodão Doce', pesoPct: '8,36 g' },
 { produto: 'Bala 600g Banana', pesoPct: '7,99 g' },
 ]
 },
 {
 categoria: 'Embalagem Bala 480g',
 itens: [
 { produto: 'Bala 480g Recheada Gigante', pesoPct: '6,53 g' },
 { produto: 'Bala 480g Recheada Sortida', pesoPct: '7,00 g' },
 { produto: 'Bala 480g Frutas Recheadas', pesoPct: '6,30 g' },
 { produto: 'Bala 480g Framboesa Premium', pesoPct: '6,37 g' },
 { produto: 'Bala 480g Café', pesoPct: '6,80 g' },
 { produto: 'Bala 480g Morango Flowpack', pesoPct: '6,70 g' },
 ]
 },
 {
 categoria: 'Embalagem Bala 250g',
 itens: [
 { produto: 'Bala 250g Frutalli', pesoPct: '4,90 g' },
 { produto: 'Bala 250g Hortelã', pesoPct: '5,11 g' },
 { produto: 'Bala 250g Canela', pesoPct: '5,69 g' },
 { produto: 'Bala 250g Piteco Frutas', pesoPct: '4,94 g' },
 { produto: 'Bala 250g Framboesa Mast.', pesoPct: '4,74 g' },
 { produto: 'Bala 250g Yogurte Morango', pesoPct: '5,11 g' },
 { produto: 'Bala 250g Yogurte Sortida', pesoPct: '5,54 g' },
 { produto: 'Bala 250g Yogurte Uva', pesoPct: '5,62 g' },
 { produto: 'Bala 250g Algodão Doce', pesoPct: '5,17 g' },
 { produto: 'Bala 250g Toffee', pesoPct: '4,80 g' },
 { produto: 'Bala 250g Mel', pesoPct: '5,75 g' },
 { produto: 'Bala 250g Cola', pesoPct: '5,34 g' },
 { produto: 'Bala 250g Azedinha', pesoPct: '5,48 g' },
 { produto: 'Bala 250g Tutti Frutti', pesoPct: '5,62 g' },
 { produto: 'Bala 250g Fresh Sortida', pesoPct: '5,40 g' },
 { produto: 'Bala 250g Recheada Gigante', pesoPct: '5,09 g' },
 { produto: 'Bala 250g Caramelo Castanha', pesoPct: '4,92 g' },
 { produto: 'Bala 250g Caramelo Brigadeiro', pesoPct: '4,90 g' },
 { produto: 'Bala 250g Caramelo Sortido', pesoPct: '5,29 g' },
 { produto: 'Bala 250g Cacau Castanha', pesoPct: '5,34 g' },
 { produto: 'Bala 250g Cacau Amendoim', pesoPct: '5,46 g' },
 { produto: 'Bala 250g Caramelo Toffee', pesoPct: '4,92 g' },
 { produto: 'Bala 250g Caramelo Leite Quadradinha', pesoPct: '4,45 g' },
 { produto: 'Bala 250g Framboesa Premium', pesoPct: '5,36 g' },
 { produto: 'Bala 250g Banana', pesoPct: '5,05 g' },
 { produto: 'Bala 250g Sortidas Tropicais', pesoPct: '5,17 g' },
 { produto: 'Bala 250g Recheadas Sortidas', pesoPct: '4,94 g' },
 { produto: 'Bala 250g Frutas Recheadas', pesoPct: '5,19 g' },
 { produto: 'Bala 250g Confeito Am. Colorido', pesoPct: '4,76 g' },
 ]
 },
 {
 categoria: 'Embalagem Bala 190g',
 itens: [
 { produto: 'Bala 190g Café', pesoPct: '5,05 g' },
 { produto: 'Bala 190g Energy Guaraná', pesoPct: '5,52 g' },
 { produto: 'Bala 190g Toffee Fukito', pesoPct: '6,57 g' },
 { produto: 'Bala 190g Fukito Sortida', pesoPct: '4,49 g' },
 ]
 },
 {
 categoria: 'Embalagem Bala 170g',
 itens: [
 { produto: 'Bala 170g Toffee', pesoPct: '3,56 g' },
 { produto: 'Bala 170g Cola', pesoPct: '4,84 g' },
 { produto: 'Bala 170g Tutti Frutti', pesoPct: '4,70 g' },
 { produto: 'Bala 170g Hortelã', pesoPct: '4,41 g' },
 ]
 },
 {
 categoria: 'Embalagem Bala 150g',
 itens: [
 { produto: 'Bala 150g Mel', pesoPct: '3,91 g' },
 { produto: 'Bala 150g Menta', pesoPct: '4,14 g' },
 { produto: 'Bala 150g Sabor Tropical', pesoPct: '3,87 g' },
 { produto: 'Bala 150g Canela', pesoPct: '3,77 g' },
 { produto: 'Bala 150g Caramelo Castanha', pesoPct: '3,71 g' },
 { produto: 'Bala 150g Yogurte Morango', pesoPct: '3,48 g' },
 { produto: 'Bala 150g Caramelo Leite', pesoPct: '3,54 g' },
 ]
 },
 {
 categoria: 'Embalagem Bala 100g',
 itens: [
 { produto: 'Bala 100g Gengibre', pesoPct: '3,32 g' },
 { produto: 'Bala 100g Café', pesoPct: '3,98 g' },
 ]
 },
 {
 categoria: 'Embalagem Bala 60g e 50g',
 itens: [
 { produto: 'Bala 60g Canela', pesoPct: '2,93 g' },
 { produto: 'Bala 60g Tutti Frutti', pesoPct: '2,86 g' },
 { produto: 'Bala 50g Diet Morango e Hortelã', pesoPct: '3,19 g' },
 ]
 },
 {
 categoria: 'Embalagem Pirulitos',
 itens: [
 { produto: 'Pirulito Bola 200g Tutti Frutti', pesoPct: '5,11 g' },
 { produto: 'Pirulito Bola 200g Algodão Doce', pesoPct: '5,15 g' },
 { produto: 'Pirulito Bola 200g Morango', pesoPct: '5,23 g' },
 { produto: 'Pirulito Bola 200g Uva', pesoPct: '5,31 g' },
 { produto: 'Pirulito Bola 200g Framboesa', pesoPct: '5,15 g' },
 { produto: 'Pirulito Bola 200g Halloween', pesoPct: '5,31 g' },
 { produto: 'Pirulito Bola 200g Grande Amor', pesoPct: '5,48 g' },
 { produto: 'Pirulito Bola 200g Sortido', pesoPct: '5,38 g' },
 { produto: 'Pirulito Bola 200g Cereja', pesoPct: '5,52 g' },
 { produto: 'Pirulito Bola 200g Space Pop', pesoPct: '5,29 g' },
 { produto: 'Pirulito Bola 480g Uva', pesoPct: '7,17 g' },
 { produto: 'Pirulito Bola 480g Algodão Doce', pesoPct: '7,73 g' },
 { produto: 'Pirulito Bola 480g Tutti Frutti', pesoPct: '7,91 g' },
 { produto: 'Pirulito Bola 480g Framboesa', pesoPct: '7,17 g' },
 { produto: 'Pirulito Bola 480g Sortido', pesoPct: '9,76 g' },
 { produto: 'Pirulito Bola 480g Cereja', pesoPct: '7,56 g' },
 { produto: 'Pirulito Bola 480g Space Pop', pesoPct: '7,54 g' },
 { produto: 'Pirulito Bola KG Sortido', pesoPct: '13,06 g' },
 { produto: 'Pirulito Bola 120g Morango', pesoPct: '3,83 g' },
 { produto: 'Pirulito Bola 120g Tutti Frutti', pesoPct: '3,96 g' },
 { produto: 'Pirulito Plano 480g Fan Pop', pesoPct: '8,47 g' },
 { produto: 'Pirulito Plano 480g Circo do Piteco', pesoPct: '9,66 g' },
 { produto: 'Pirulito Plano 480g Tutti Frutti', pesoPct: '8,47 g' },
 { produto: 'Pirulito Plano 480g Algodão Doce', pesoPct: '8,05 g' },
 { produto: 'Pirulito Plano 350g Fan Pop', pesoPct: '8,84 g' },
 { produto: 'Pirulito Plano 190g Fan Pop', pesoPct: '6,51 g' },
 { produto: 'Pirulito Plano 190g Circo do Piteco', pesoPct: '8,03 g' },
 { produto: 'Pirulito Plano 190g Tutti Frutti', pesoPct: '6,08 g' },
 { produto: 'Pirulito Plano 190g Algodão Doce', pesoPct: '6,51 g' },
 ]
 },
 {
 categoria: 'Exportações',
 itens: [
 { produto: 'Bala 300g Piteco Frutas', pesoPct: '5,44 g' },
 { produto: 'Bala 300g Toffee', pesoPct: '5,01 g' },
 { produto: 'Bala 300g Tutti Frutti', pesoPct: '4,76 g' },
 { produto: 'Bala 300g Yogurte Sortida', pesoPct: '4,74 g' },
 { produto: 'Bala 300g Yogurte Morango', pesoPct: '5,58 g' },
 { produto: 'Bala 280g Export. Miel', pesoPct: '4,88 g' },
 { produto: 'Bala 1,5 KG Party Mix (pct laranja)', pesoPct: '15,60 g' },
 { produto: 'Bala 1,5 KG Jumbo Party Mix (pct transp.)', pesoPct: '15,18 g' },
 { produto: 'Bala 0,900 KG Party Mix (pct transp.)', pesoPct: '12,26 g' },
 { produto: 'Pirulito 20g Algodão Doce 1 KG', pesoPct: '14,97 g' },
 { produto: 'Pirulito 20g Gourmet 1 KG (Emb. Roxa Haitti)', pesoPct: '11,78 g' },
 { produto: 'Emb. 85g Ovinho de Chocolate 5g', pesoPct: '3,96 g' },
 { produto: 'Emb. 85g Bolinha de Chocolate 5g', pesoPct: '3,93 g' },
 { produto: 'Emb. 4 LBS Party Mix', pesoPct: '15,84 g' },
 { produto: 'Emb. 20 OZ Party Mix', pesoPct: '9,48 g' },
 { produto: 'Holanda 200g Heart Pop / Fruity Ball / Smiley / Morango', pesoPct: '6,80 g' },
 { produto: 'Holanda 300g Heart Pop / Fruity Ball / Smiley / Morango', pesoPct: '6,95 g' },
 { produto: 'Holanda 200g Heart Pop Pirulito Plano', pesoPct: '7,31 g' },
 { produto: 'Holanda 460g Halloween', pesoPct: '10,71 g' },
 { produto: 'Bala 700g Family Favourites', pesoPct: '12,61 g' },
 ]
 }
]

// ---- Utilidades numéricas ----
function primeiroNumero(txt) {
 const m = String(txt).match(/-?\d+(?:[.,]\d+)?/)
 return m ? parseFloat(m[0].replace(',', '.')) : NaN
}
function fmt(n, dec = 1) {
 if (!isFinite(n)) return '—'
 return n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function fmtInt(n) {
 if (!isFinite(n)) return '—'
 return Math.round(n).toLocaleString('pt-BR')
}

// Enriquecer os itens com os valores calculados
const ITENS = []
DADOS.forEach((secao) => {
 const eRotulo = secao.categoria === 'Rótulos'
 secao.itens.forEach((it) => {
 const pesoG = primeiroNumero(it.pesoPct) // gramas de material por pacote/unidade
 const item = {
 categoria: secao.categoria,
 produto: it.produto,
 eRotulo,
 pesoG,
 // Para embalagem: pacotes por kg = 1000 / peso do pacote (g)
 // Para rótulo: kg de produto por kg de rótulo (valor já informado)
 base: eRotulo ? primeiroNumero(it.rendimento) : (1000 / pesoG),
 unidadeSaida: eRotulo ? 'kg de produto' : 'pacotes'
 }
 ITENS.push(item)
 })
})

const PERDA = 0.03 // 3% de perda

// ============ Calculadora ============
function itemPorNome(nome) {
 return ITENS.find((i) => i.produto === nome)
}

function calcular() {
 const sel = document.getElementById('calc-produto')
 const item = itemPorNome(sel.value)
 const usarPerda = document.getElementById('calc-perda').checked
 const fator = usarPerda ? (1 - PERDA) : 1
 const box = document.getElementById('calc-resultado')
 if (!item) { box.innerHTML = ''; return }

 const kgMaterial = parseFloat((document.getElementById('calc-kg').value || '').replace(',', '.'))
 const alvo = parseFloat((document.getElementById('calc-alvo').value || '').replace(',', '.'))

 const rendComPerda = item.base * fator // saída por kg de material
 const unidadeMaterial = item.eRotulo ? 'kg de rótulo/forro' : 'kg de embalagem'

 let linhas = ''

 // Rendimento base (sempre mostrado)
 if (item.eRotulo) {
 linhas += `<div class="mb-2"><span class="text-muted">Rendimento:</span><strong>${fmt(rendComPerda, 2)} kg de produto</strong> por kg de rótulo/forro</div>`
 } else {
 linhas += `<div class="mb-2"><span class="text-muted">Peso da embalagem:</span><strong>${fmt(item.pesoG, 2)} g/pct</strong> · Rendimento: <strong>${fmtInt(rendComPerda)} pacotes</strong> por kg</div>`
 }

 // A) material -> produção
 if (isFinite(kgMaterial) && kgMaterial > 0) {
 if (item.eRotulo) {
 const kgProduto = kgMaterial * rendComPerda
 linhas += `<div class="alert alert-success mb-2 py-2">Com <strong>${fmt(kgMaterial, 2)} kg</strong> de rótulo/forro você produz <strong>≈ ${fmt(kgProduto, 1)} kg de produto</strong>.</div>`
 } else {
 const pacotes = kgMaterial * rendComPerda
 const kgProduzido = pacotes * item.pesoG / 1000 // peso de material que vira pacote — só referência
 linhas += `<div class="alert alert-success mb-2 py-2">Com <strong>${fmt(kgMaterial, 2)} kg</strong> de embalagem você fecha <strong>≈ ${fmtInt(pacotes)} pacotes</strong>.</div>`
 }
 }

 // B) alvo de produção -> material necessário
 if (isFinite(alvo) && alvo > 0) {
 if (item.eRotulo) {
 const kgMat = alvo / rendComPerda
 linhas += `<div class="alert alert-warning mb-0 py-2 text-dark">Para produzir <strong>${fmt(alvo, 1)} kg de produto</strong> você precisa de <strong>≈ ${fmt(kgMat, 2)} kg</strong> de rótulo/forro.</div>`
 } else {
 const kgMat = (alvo / rendComPerda)
 linhas += `<div class="alert alert-warning mb-0 py-2 text-dark">Para fechar <strong>${fmtInt(alvo)} pacotes</strong> você precisa de <strong>≈ ${fmt(kgMat, 2)} kg</strong> de embalagem.</div>`
 }
 }

 box.innerHTML = linhas
}

function montarCalculadora(wrapper) {
 const optgroups = DADOS.map((secao) => `
 <optgroup label="${secao.categoria}">
 ${secao.itens.map((it) => `<option value="${it.produto.replace(/"/g, '&quot;')}">${it.produto}</option>`).join('')}
 </optgroup>`).join('')

 const card = document.createElement('div')
 card.className = 'card mb-4'
 card.innerHTML = `
 <div class="card-body"><h5 class="secao-titulo-card mb-3">Calculadora de rendimento</h5><div class="row g-3"><div class="col-12 col-lg-5"><label class="form-label fw-semibold small">Produto</label><select id="calc-produto" class="form-select">${optgroups}</select></div><div class="col-6 col-lg-3"><label class="form-label fw-semibold small">Material disponível (kg)</label><input type="number" id="calc-kg" class="form-control" placeholder="0" min="0" step="any"></div><div class="col-6 col-lg-4"><label class="form-label fw-semibold small" id="calc-alvo-label">Produção desejada (pacotes)</label><input type="number" id="calc-alvo" class="form-control" placeholder="0" min="0" step="any"></div></div><div class="form-check mt-3"><input class="form-check-input" type="checkbox" id="calc-perda"><label class="form-check-label small" for="calc-perda">Descontar 3% de perda</label></div><div id="calc-resultado" class="mt-3"></div></div>`
 wrapper.appendChild(card)

 const sel = card.querySelector('#calc-produto')
 const atualizarLabelAlvo = () => {
 const item = itemPorNome(sel.value)
 document.getElementById('calc-alvo-label').textContent =
 item && item.eRotulo ? 'Produção desejada (kg de produto)' : 'Produção desejada (pacotes)'
 }
 sel.addEventListener('change', () => { atualizarLabelAlvo(); calcular() })
 card.querySelector('#calc-kg').addEventListener('input', calcular)
 card.querySelector('#calc-alvo').addEventListener('input', calcular)
 card.querySelector('#calc-perda').addEventListener('change', calcular)
 atualizarLabelAlvo()
 calcular()
}

// ============ Tabela de referência (calculada) ============
function renderizarTabela(filtro) {
 const container = document.getElementById('conteudo-referencia')
 const termo = (filtro || '').toLowerCase().trim()
 container.innerHTML = ''

 DADOS.forEach((secao) => {
 const eRotulo = secao.categoria === 'Rótulos'
 const itens = ITENS.filter((i) => i.categoria === secao.categoria &&
 (!termo || i.produto.toLowerCase().includes(termo)))
 if (itens.length === 0) return

 const cabecalho = eRotulo
 ? `<th class="text-center" style="white-space:nowrap">Peso ref.</th><th class="text-center" style="white-space:nowrap">kg de produto / kg de rótulo</th><th class="text-center" style="white-space:nowrap">kg de rótulo / 100 kg produto</th>`
 : `<th class="text-center" style="white-space:nowrap">Peso da embalagem</th><th class="text-center" style="white-space:nowrap">Pacotes por kg</th><th class="text-center" style="white-space:nowrap">kg p/ 1.000 pacotes</th>`

 const linhas = itens.map((i) => {
 if (eRotulo) {
 const kgRotPor100 = 100 / i.base
 return `<tr><td>${i.produto}</td><td class="text-center">${fmt(i.pesoG, 2)} g</td><td class="text-center fw-semibold text-success">${fmt(i.base, 2)} kg</td><td class="text-center">${fmt(kgRotPor100, 2)} kg</td></tr>`
 }
 const kgPor1000 = 1000 * i.pesoG / 1000 // = pesoG kg? não: 1000 pacotes * pesoG g = pesoG kg
 return `<tr><td>${i.produto}</td><td class="text-center">${fmt(i.pesoG, 2)} g</td><td class="text-center fw-semibold text-success">${fmtInt(i.base)} pct</td><td class="text-center">${fmt(i.pesoG, 2)} kg</td></tr>`
 }).join('')

 const bloco = document.createElement('div')
 bloco.className = 'mb-4'
 bloco.innerHTML = `
 <h5 class="secao-titulo-card mb-3">${secao.categoria}</h5><div class="card"><div class="table-responsive"><table class="table table-sm table-hover mb-0"><thead><tr><th>Produto</th>${cabecalho}</tr></thead><tbody>${linhas}</tbody></table></div></div>`
 container.appendChild(bloco)
 })

 if (container.innerHTML === '') {
 container.innerHTML = '<p class="text-muted fst-italic">Nenhum produto encontrado.</p>'
 }
}

export function iniciarReferencia(elementoContainer) {
 const wrapper = elementoContainer || document.getElementById('conteudo-referencia-wrapper')
 if (!wrapper) return

 wrapper.innerHTML = `
 <div id="wrap-calculadora"></div><div class="mb-3"><input type="text" id="busca-referencia" class="form-control" placeholder="Buscar produto..."></div><div id="conteudo-referencia"></div>
 `

 montarCalculadora(wrapper.querySelector('#wrap-calculadora'))
 renderizarTabela('')

 wrapper.querySelector('#busca-referencia').addEventListener('input', (e) => {
 renderizarTabela(e.target.value)
 })
}

async function iniciar() {
 const perfil = exigirPapel('todos')
 if (!perfil) return
 montarCabecalho(perfil.papel)
 iniciarReferencia(null)
}

if (document.body.dataset.pagina === 'referencia.html') {
 iniciar()
}