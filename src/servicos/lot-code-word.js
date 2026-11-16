const fs = require('fs')
const path = require('path')
const {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HorizontalPositionRelativeFrom,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  TextWrappingType,
  VerticalAlign,
  VerticalPositionRelativeFrom,
  WidthType
} = require('docx')

const PASTA_IMAGENS = path.join(__dirname, '..', '..', 'publico', 'imagens')
const LARGURA_PAGINA_PX = 794
const ALTURA_PAGINA_PX = 1123
const EMU_POR_PIXEL = 9525
const LINHAS_MINIMAS = 4
const FONTE = 'Arial'

const TEXTOS = {
  EN: {
    titulo: 'LOT CODE LIST',
    importador: 'IMPORTER:',
    invoice: 'INVOICE',
    descricao: 'DESCRIPTION',
    lote: 'LOT NUMBER',
    caixas: 'NUMBER OF BOXES PER BATCH',
    fabricacao: 'MANUFACTURING DATE',
    validade: 'BEST BEFORE DATE',
    total: 'PACKS/CANS',
    assinado: 'Signed',
    cargoRotulo: 'Position',
    data: 'Date',
    cargo: 'Food Engineer',
    unidades: { CARTONS: 'CARTONS', CANS: 'CANS', PACKS: 'PACKS' }
  },
  ES: {
    titulo: 'LISTA DE CÓDIGOS DE LOTE',
    importador: 'IMPORTADOR:',
    invoice: 'FACTURA',
    descricao: 'DESCRIPCIÓN',
    lote: 'NÚMERO DE LOTE',
    caixas: 'NÚMERO DE CAJAS POR LOTE',
    fabricacao: 'FECHA DE FABRICACIÓN',
    validade: 'FECHA DE VENCIMIENTO',
    total: 'PAQUETES/LATAS',
    assinado: 'Firmado',
    cargoRotulo: 'Cargo',
    data: 'Fecha',
    cargo: 'Ingeniera de Alimentos',
    unidades: { CARTONS: 'CAJAS', CANS: 'LATAS', PACKS: 'PAQUETES' }
  }
}

const MESES = {
  EN: ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'],
  ES: ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
}

function sufixoOrdinal(dia) {
  if (dia % 100 >= 11 && dia % 100 <= 13) return 'th'
  const ultimo = dia % 10
  if (ultimo === 1) return 'st'
  if (ultimo === 2) return 'nd'
  if (ultimo === 3) return 'rd'
  return 'th'
}

function dataPorExtenso(iso, idioma) {
  const [ano, mes, dia] = String(iso || '').slice(0, 10).split('-').map(Number)
  if (!ano || !mes || !dia) return ''
  if (idioma === 'ES') return `${dia} DE ${MESES.ES[mes - 1]} DE ${ano}.`
  return `${MESES.EN[mes - 1]}, ${dia}${sufixoOrdinal(dia)}, ${ano}.`
}

function lerImagem(nome) {
  return fs.readFileSync(path.join(PASTA_IMAGENS, nome))
}

function imagemFlutuante(nome, tipo, largura, altura, esquerda, topo, atrasDoTexto) {
  return new ImageRun({
    type: tipo,
    data: lerImagem(nome),
    transformation: { width: largura, height: altura },
    floating: {
      horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: Math.round(esquerda * EMU_POR_PIXEL) },
      verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: Math.round(topo * EMU_POR_PIXEL) },
      behindDocument: atrasDoTexto,
      allowOverlap: true,
      wrap: { type: TextWrappingType.NONE }
    }
  })
}

function texto(conteudo, opcoes) {
  return new TextRun({ text: conteudo, font: FONTE, ...opcoes })
}

function paragrafo(conteudo, opcoes) {
  const { run, ...resto } = opcoes || {}
  return new Paragraph({ children: [texto(conteudo, run)], ...resto })
}

const LINHA = { style: BorderStyle.SINGLE, size: 6, color: '000000' }
const BORDAS = { top: LINHA, bottom: LINHA, left: LINHA, right: LINHA }

function celula(largura, paragrafos, opcoes) {
  return new TableCell({
    width: { size: largura, type: WidthType.DXA },
    borders: BORDAS,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: paragrafos,
    ...opcoes
  })
}

function paragrafosEmBranco(quantidade) {
  return Array.from({ length: quantidade }, () => new Paragraph({ spacing: { line: 480 }, children: [texto('')] }))
}

function larguras(temFabricacao, temValidade) {
  if (temFabricacao && temValidade) return [2500, 1300, 1600, 1600, 1600, 1306]
  return [3200, 1500, 1800, 1700, 1706]
}

function montarTabela(lista, T, idioma) {
  const temFabricacao = lista.tipo_data !== 'VALIDADE'
  const temValidade = lista.tipo_data !== 'FABRICACAO'
  const colunas = larguras(temFabricacao, temValidade)
  const tamanhoTitulo = temFabricacao && temValidade ? 16 : idioma === 'ES' || temFabricacao ? 18 : 20
  const titulos = [T.descricao, T.lote, T.caixas]
  if (temFabricacao) titulos.push(T.fabricacao)
  if (temValidade) titulos.push(T.validade)
  titulos.push(T.total)

  const cabecalho = new TableRow({
    tableHeader: true,
    children: titulos.map((titulo, indice) =>
      celula(
        colunas[indice],
        [
          paragrafo(titulo, {
            alignment: indice === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
            run: { bold: true, size: tamanhoTitulo }
          })
        ],
        { verticalAlign: VerticalAlign.BOTTOM }
      )
    )
  })

  const linhas = (lista.itens || []).map((item) => {
    const quantidade = Math.max((item.lotes || []).length, LINHAS_MINIMAS)
    const unidade = T.unidades[item.unidade] || item.unidade
    const celulas = [
      celula(colunas[0], [paragrafo(item.descricao, { run: { size: 20 } })]),
      celula(colunas[1], paragrafosEmBranco(quantidade)),
      celula(colunas[2], paragrafosEmBranco(quantidade))
    ]
    let indice = 3
    if (temFabricacao) celulas.push(celula(colunas[indice++], paragrafosEmBranco(quantidade)))
    if (temValidade) celulas.push(celula(colunas[indice++], paragrafosEmBranco(quantidade)))
    celulas.push(
      celula(colunas[indice], [
        paragrafo('________', { alignment: AlignmentType.CENTER, run: { size: 20 } }),
        paragrafo(unidade, { alignment: AlignmentType.CENTER, run: { size: 20 } })
      ])
    )
    return new TableRow({ cantSplit: true, children: celulas })
  })

  return new Table({
    width: { size: colunas.reduce((soma, n) => soma + n, 0), type: WidthType.DXA },
    columnWidths: colunas,
    rows: [cabecalho, ...linhas]
  })
}

async function gerarWord(lista) {
  const idioma = lista.idioma === 'ES' ? 'ES' : 'EN'
  const T = TEXTOS[idioma]
  const enderecos = String(lista.importador_endereco || '')
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean)

  const cabecalhoPagina = new Header({
    children: [
      new Paragraph({
        children: [
          imagemFlutuante('lot-code-cabecalho.jpg', 'jpg', LARGURA_PAGINA_PX, 55, 0, 0, false),
          imagemFlutuante('lot-code-marca-clara.png', 'png', 560, 141, (LARGURA_PAGINA_PX - 560) / 2, 440, true)
        ]
      })
    ]
  })

  const rodapePagina = new Footer({
    children: [
      new Paragraph({
        children: [imagemFlutuante('lot-code-rodape.jpg', 'jpg', LARGURA_PAGINA_PX, 69, 0, ALTURA_PAGINA_PX - 69, false)]
      })
    ]
  })

  const corpo = [
    paragrafo(T.titulo, {
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      run: { bold: true, size: 36, underline: {} }
    }),
    paragrafo(T.importador, { spacing: { after: 120 }, run: { bold: true, size: 24, underline: {} } }),
    paragrafo(lista.importador_nome, { indent: { left: 240 }, spacing: { line: 480 }, run: { bold: true, size: 24 } }),
    ...enderecos.map((linha) =>
      paragrafo(linha, { indent: { left: 240 }, spacing: { line: 480 }, run: { size: 24 } })
    ),
    ...(lista.importador_att
      ? [paragrafo(`ATT: ${lista.importador_att}`, { indent: { left: 240 }, spacing: { line: 480 }, run: { size: 24 } })]
      : []),
    new Paragraph({
      spacing: { before: 160, after: 240 },
      indent: { right: 5200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: '000000', space: 1 } },
      children: [texto('')]
    }),
    paragrafo(`${T.invoice}: ${lista.fatura}`, {
      indent: { left: 700 },
      spacing: { after: 240, line: 480 },
      run: { bold: true, size: 24 }
    }),
    montarTabela(lista, T, idioma),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 700 },
      children: [
        new ImageRun({
          type: 'jpg',
          data: lerImagem('lot-code-assinatura.jpg'),
          transformation: { width: 151, height: 74 }
        })
      ]
    }),
    paragrafo(`${T.assinado}: ______________`, {
      alignment: AlignmentType.CENTER,
      spacing: { line: 480 },
      run: { bold: true, size: 24 }
    }),
    paragrafo(`${T.cargoRotulo}: ${T.cargo}`, {
      alignment: AlignmentType.CENTER,
      spacing: { line: 480 },
      run: { bold: true, size: 24 }
    }),
    paragrafo(`${T.data}: ${dataPorExtenso(lista.data_documento, idioma)}`, {
      alignment: AlignmentType.CENTER,
      spacing: { line: 480 },
      run: { bold: true, size: 24 }
    })
  ]

  const documento = new Document({
    creator: 'Pietrobon',
    title: `${T.titulo} ${lista.fatura}`,
    styles: { default: { document: { run: { font: FONTE, size: 22 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1500, bottom: 1700, left: 1000, right: 1000, header: 0, footer: 0 }
          }
        },
        headers: { default: cabecalhoPagina },
        footers: { default: rodapePagina },
        children: corpo
      }
    ]
  })

  return Packer.toBuffer(documento)
}

module.exports = { gerarWord }
