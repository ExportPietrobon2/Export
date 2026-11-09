export const PAISES = [
  'AFEGANISTAO',
  'AFRICA DO SUL',
  'ALBANIA',
  'ALEMANHA',
  'ANDORRA',
  'ANGOLA',
  'ANTIGUA E BARBUDA',
  'ARABIA SAUDITA',
  'ARGELIA',
  'ARGENTINA',
  'ARMENIA',
  'ARUBA',
  'AUSTRALIA',
  'AUSTRIA',
  'AZERBAIJAO',
  'BAHAMAS',
  'BAHREIN',
  'BANGLADESH',
  'BARBADOS',
  'BELGICA',
  'BELIZE',
  'BENIN',
  'BIELORRUSSIA',
  'BOLIVIA',
  'BOSNIA E HERZEGOVINA',
  'BOTSUANA',
  'BRASIL',
  'BRUNEI',
  'BULGARIA',
  'BURKINA FASO',
  'BURUNDI',
  'BUTAO',
  'CABO VERDE',
  'CAMAROES',
  'CAMBOJA',
  'CANADA',
  'CATAR',
  'CAZAQUISTAO',
  'CHADE',
  'CHILE',
  'CHINA',
  'CHIPRE',
  'COLOMBIA',
  'COMORES',
  'CONGO',
  'COREIA DO NORTE',
  'COREIA DO SUL',
  'COSTA DO MARFIM',
  'COSTA RICA',
  'CROACIA',
  'CUBA',
  'CURACAO',
  'DINAMARCA',
  'DJIBUTI',
  'DOMINICA',
  'EGITO',
  'EL SALVADOR',
  'EMIRADOS ARABES UNIDOS',
  'EQUADOR',
  'ERITREIA',
  'ESLOVAQUIA',
  'ESLOVENIA',
  'ESPANHA',
  'ESTADOS UNIDOS',
  'ESTONIA',
  'ESWATINI',
  'ETIOPIA',
  'FIJI',
  'FILIPINAS',
  'FINLANDIA',
  'FRANCA',
  'GABAO',
  'GAMBIA',
  'GANA',
  'GEORGIA',
  'GRANADA',
  'GRECIA',
  'GUATEMALA',
  'GUIANA',
  'GUIANA FRANCESA',
  'GUINE',
  'GUINE EQUATORIAL',
  'GUINE-BISSAU',
  'HAITI',
  'HOLANDA',
  'HONDURAS',
  'HONG KONG',
  'HUNGRIA',
  'IEMEN',
  'ILHAS CAYMAN',
  'INDIA',
  'INDONESIA',
  'IRA',
  'IRAQUE',
  'IRLANDA',
  'ISLANDIA',
  'ISRAEL',
  'ITALIA',
  'JAMAICA',
  'JAPAO',
  'JORDANIA',
  'KUWAIT',
  'LAOS',
  'LESOTO',
  'LETONIA',
  'LIBANO',
  'LIBERIA',
  'LIBIA',
  'LIECHTENSTEIN',
  'LITUANIA',
  'LUXEMBURGO',
  'MACAU',
  'MACEDONIA DO NORTE',
  'MADAGASCAR',
  'MALASIA',
  'MALAWI',
  'MALDIVAS',
  'MALI',
  'MALTA',
  'MARROCOS',
  'MAURICIO',
  'MAURITANIA',
  'MEXICO',
  'MIANMAR',
  'MOCAMBIQUE',
  'MOLDAVIA',
  'MONACO',
  'MONGOLIA',
  'MONTENEGRO',
  'NAMIBIA',
  'NEPAL',
  'NICARAGUA',
  'NIGER',
  'NIGERIA',
  'NORUEGA',
  'NOVA ZELANDIA',
  'OMA',
  'PALESTINA',
  'PANAMA',
  'PAPUA-NOVA GUINE',
  'PAQUISTAO',
  'PARAGUAI',
  'PERU',
  'POLONIA',
  'PORTO RICO',
  'PORTUGAL',
  'QUENIA',
  'QUIRGUISTAO',
  'REINO UNIDO',
  'REPUBLICA CENTRO-AFRICANA',
  'REPUBLICA DEMOCRATICA DO CONGO',
  'REPUBLICA DOMINICANA',
  'REPUBLICA TCHECA',
  'ROMENIA',
  'RUANDA',
  'RUSSIA',
  'SANTA LUCIA',
  'SAO CRISTOVAO E NEVIS',
  'SAO TOME E PRINCIPE',
  'SAO VICENTE E GRANADINAS',
  'SENEGAL',
  'SERRA LEOA',
  'SERVIA',
  'SEYCHELLES',
  'SINGAPURA',
  'SIRIA',
  'SOMALIA',
  'SRI LANKA',
  'SUDAO',
  'SUDAO DO SUL',
  'SUECIA',
  'SUICA',
  'SURINAME',
  'TAILANDIA',
  'TAIWAN',
  'TANZANIA',
  'TIMOR-LESTE',
  'TOGO',
  'TRINIDAD E TOBAGO',
  'TUNISIA',
  'TURCOMENISTAO',
  'TURQUIA',
  'UCRANIA',
  'UGANDA',
  'URUGUAI',
  'UZBEQUISTAO',
  'VANUATU',
  'VENEZUELA',
  'VIETNA',
  'ZAMBIA',
  'ZIMBABUE'
]

const semAcento = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase()

const escapar = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export function normalizarValor(v) {
  return semAcento(v).replace(/\s+/g, ' ')
}

function opcoes(lista, atual, rotuloVazio) {
  const valorAtual = normalizarValor(atual)
  const itens = [...new Set(lista.map(normalizarValor).filter(Boolean))]
  if (valorAtual && !itens.includes(valorAtual)) itens.unshift(valorAtual)
  return (
    `<option value="">${escapar(rotuloVazio)}</option>` +
    itens
      .map((v) => `<option value="${escapar(v)}" ${v === valorAtual ? 'selected' : ''}>${escapar(v)}</option>`)
      .join('')
  )
}

export function seletorPais(id, atual, classe = 'form-select form-select-sm') {
  return `<select id="${id}" class="${classe}">${opcoes(PAISES, atual, 'Selecione o país…')}</select>`
}

export function seletorComNovo(id, valores, atual, rotulo, classe = 'form-select form-select-sm') {
  return `<select id="${id}" class="${classe}" data-novo-rotulo="${escapar(rotulo)}">${opcoes(
    valores,
    atual,
    'Selecione…'
  )}<option value="__novo__">+ Novo ${escapar(rotulo)}…</option></select>`
}

export function ativarSeletoresComNovo(raiz = document) {
  raiz.querySelectorAll('select[data-novo-rotulo]').forEach((sel) => {
    if (sel.dataset.ativo) return
    sel.dataset.ativo = '1'
    let anterior = sel.value
    sel.addEventListener('focus', () => {
      anterior = sel.value
    })
    sel.addEventListener('change', () => {
      if (sel.value !== '__novo__') {
        anterior = sel.value
        return
      }
      const novo = normalizarValor(window.prompt(`Novo ${sel.dataset.novoRotulo}:`) || '')
      if (!novo) {
        sel.value = anterior
        return
      }
      let opt = [...sel.options].find((o) => o.value === novo)
      if (!opt) {
        opt = new Option(novo, novo)
        sel.insertBefore(opt, sel.querySelector('option[value="__novo__"]'))
      }
      sel.value = novo
      anterior = novo
    })
  })
}
