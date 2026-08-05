import { Buffer } from "node:buffer";

export type XlsxCellStyle =
  | "title"
  | "label"
  | "header"
  | "text"
  | "integer"
  | "decimal"
  | "money"
  | "percent"
  | "date"
  | "success"
  | "warning";

export type XlsxCellValue = string | number | boolean | Date | null | undefined;
export type XlsxCell = XlsxCellValue | {
  value: XlsxCellValue;
  style?: XlsxCellStyle;
};

export type XlsxWorksheet = {
  name: string;
  rows: XlsxCell[][];
  columns?: Array<{ width?: number }>;
  freezeRows?: number;
  autoFilterRow?: number;
};

type ZipEntry = {
  path: string;
  data: Buffer;
};

const styleIndex: Record<XlsxCellStyle, number> = {
  title: 1,
  label: 2,
  header: 3,
  text: 4,
  integer: 5,
  decimal: 6,
  money: 7,
  percent: 8,
  date: 9,
  success: 10,
  warning: 11
};

const crcTable = createCrcTable();

export function createXlsxWorkbook(sheets: XlsxWorksheet[]) {
  const normalizedSheets = normalizeSheets(sheets);
  const now = new Date();
  const files: ZipEntry[] = [
    xmlEntry("[Content_Types].xml", buildContentTypesXml(normalizedSheets.length)),
    xmlEntry("_rels/.rels", buildRootRelsXml()),
    xmlEntry("docProps/core.xml", buildCoreXml(now)),
    xmlEntry("docProps/app.xml", buildAppXml(normalizedSheets.map((sheet) => sheet.name))),
    xmlEntry("xl/workbook.xml", buildWorkbookXml(normalizedSheets.map((sheet) => sheet.name))),
    xmlEntry("xl/_rels/workbook.xml.rels", buildWorkbookRelsXml(normalizedSheets.length)),
    xmlEntry("xl/styles.xml", buildStylesXml())
  ];

  normalizedSheets.forEach((sheet, index) => {
    files.push(xmlEntry(`xl/worksheets/sheet${index + 1}.xml`, buildWorksheetXml(sheet)));
  });

  return createZip(files, now);
}

function normalizeSheets(sheets: XlsxWorksheet[]) {
  const usedNames = new Set<string>();

  return sheets.map((sheet, index) => {
    const baseName = sanitizeSheetName(sheet.name) || `Sheet ${index + 1}`;
    let name = baseName;
    let suffix = 2;

    while (usedNames.has(name)) {
      const suffixText = ` ${suffix}`;
      name = `${baseName.slice(0, 31 - suffixText.length)}${suffixText}`;
      suffix += 1;
    }

    usedNames.add(name);

    return {
      ...sheet,
      name
    };
  });
}

function sanitizeSheetName(name: string) {
  return name.replace(/[\\/?*:[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31);
}

function buildWorksheetXml(sheet: XlsxWorksheet) {
  const maxCols = Math.max(
    1,
    sheet.columns?.length ?? 0,
    ...sheet.rows.map((row) => row.length)
  );
  const maxRows = Math.max(1, sheet.rows.length);
  const dimension = `A1:${columnName(maxCols)}${maxRows}`;
  const colsXml = sheet.columns?.length
    ? `<cols>${Array.from({ length: maxCols }, (_, index) => {
      const width = sheet.columns?.[index]?.width ?? 14;
      return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
    }).join("")}</cols>`
    : "";
  const sheetViewsXml = sheet.freezeRows
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${sheet.freezeRows}" topLeftCell="A${sheet.freezeRows + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : `<sheetViews><sheetView workbookViewId="0"/></sheetViews>`;
  const rowsXml = sheet.rows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 1;
    const cellsXml = row.map((cell, cellIndex) => buildCellXml(cell, cellIndex + 1, rowNumber)).join("");
    return `<row r="${rowNumber}">${cellsXml}</row>`;
  }).join("");
  const autoFilterXml = sheet.autoFilterRow && sheet.rows.length > sheet.autoFilterRow
    ? `<autoFilter ref="A${sheet.autoFilterRow}:${columnName(maxCols)}${sheet.rows.length}"/>`
    : "";

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    `<dimension ref="${dimension}"/>`,
    sheetViewsXml,
    '<sheetFormatPr defaultRowHeight="15"/>',
    colsXml,
    `<sheetData>${rowsXml}</sheetData>`,
    autoFilterXml,
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>',
    '</worksheet>'
  ].join("");
}

function buildCellXml(cell: XlsxCell, column: number, row: number) {
  const cellData = normalizeCell(cell);
  const style = cellData.style ? styleIndex[cellData.style] : 0;
  const styleAttribute = style ? ` s="${style}"` : "";
  const reference = `${columnName(column)}${row}`;
  const value = cellData.value;

  if (value === null || value === undefined || value === "") {
    return `<c r="${reference}"${styleAttribute}/>`;
  }

  if (value instanceof Date) {
    return `<c r="${reference}"${styleAttribute}><v>${dateToExcelSerial(value)}</v></c>`;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${reference}"${styleAttribute}><v>${value}</v></c>`;
  }

  if (typeof value === "boolean") {
    return `<c r="${reference}" t="b"${styleAttribute}><v>${value ? 1 : 0}</v></c>`;
  }

  const text = String(value);
  const preserveSpace = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : "";

  return `<c r="${reference}" t="inlineStr"${styleAttribute}><is><t${preserveSpace}>${escapeXml(text)}</t></is></c>`;
}

function normalizeCell(cell: XlsxCell): { value: XlsxCellValue; style?: XlsxCellStyle } {
  if (
    cell &&
    typeof cell === "object" &&
    !(cell instanceof Date) &&
    "value" in cell
  ) {
    return cell;
  }

  return { value: cell };
}

function buildContentTypesXml(sheetCount: number) {
  const worksheetOverrides = Array.from({ length: sheetCount }, (_, index) =>
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join("");

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>',
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
    worksheetOverrides,
    '</Types>'
  ].join("");
}

function buildRootRelsXml() {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>',
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>',
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>',
    '</Relationships>'
  ].join("");
}

function buildCoreXml(now: Date) {
  const timestamp = now.toISOString();

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
    '<dc:title>Sales and stock report</dc:title>',
    '<dc:creator>ProTech admin panel</dc:creator>',
    `<dcterms:created xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:created>`,
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:modified>`,
    '</cp:coreProperties>'
  ].join("");
}

function buildAppXml(sheetNames: string[]) {
  const titles = sheetNames.map((name) => `<vt:lpstr>${escapeXml(name)}</vt:lpstr>`).join("");

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">',
    '<Application>ProTech admin panel</Application>',
    '<DocSecurity>0</DocSecurity>',
    '<ScaleCrop>false</ScaleCrop>',
    '<HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>',
    String(sheetNames.length),
    '</vt:i4></vt:variant></vt:vector></HeadingPairs>',
    `<TitlesOfParts><vt:vector size="${sheetNames.length}" baseType="lpstr">${titles}</vt:vector></TitlesOfParts>`,
    '<Company></Company>',
    '<LinksUpToDate>false</LinksUpToDate>',
    '<SharedDoc>false</SharedDoc>',
    '<HyperlinksChanged>false</HyperlinksChanged>',
    '<AppVersion>16.0300</AppVersion>',
    '</Properties>'
  ].join("");
}

function buildWorkbookXml(sheetNames: string[]) {
  const sheetsXml = sheetNames.map((name, index) =>
    `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
  ).join("");

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    '<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="14400"/></bookViews>',
    `<sheets>${sheetsXml}</sheets>`,
    '<calcPr calcId="191029"/>',
    '</workbook>'
  ].join("");
}

function buildWorkbookRelsXml(sheetCount: number) {
  const sheetRels = Array.from({ length: sheetCount }, (_, index) =>
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  ).join("");

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    sheetRels,
    `<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`,
    '</Relationships>'
  ].join("");
}

function buildStylesXml() {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    '<numFmts count="4">',
    '<numFmt numFmtId="164" formatCode="#,##0.00"/>',
    '<numFmt numFmtId="165" formatCode="#,##0.00"/>',
    '<numFmt numFmtId="166" formatCode="0.0%"/>',
    '<numFmt numFmtId="167" formatCode="yyyy-mm-dd hh:mm"/>',
    '</numFmts>',
    '<fonts count="4">',
    '<font><sz val="11"/><color rgb="FF18181B"/><name val="Calibri"/><family val="2"/></font>',
    '<font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>',
    '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>',
    '<font><b/><sz val="11"/><color rgb="FF18181B"/><name val="Calibri"/><family val="2"/></font>',
    '</fonts>',
    '<fills count="6">',
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FF2F6F4E"/><bgColor indexed="64"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FF3F7F5F"/><bgColor indexed="64"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFEAF6EF"/><bgColor indexed="64"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF3D8"/><bgColor indexed="64"/></patternFill></fill>',
    '</fills>',
    '<borders count="2">',
    '<border><left/><right/><top/><bottom/><diagonal/></border>',
    '<border><left style="thin"><color rgb="FFE4E4E7"/></left><right style="thin"><color rgb="FFE4E4E7"/></right><top style="thin"><color rgb="FFE4E4E7"/></top><bottom style="thin"><color rgb="FFE4E4E7"/></bottom><diagonal/></border>',
    '</borders>',
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>',
    '<cellXfs count="12">',
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center"/></xf>',
    '<xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>',
    '<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>',
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>',
    '<xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>',
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>',
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>',
    '<xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>',
    '<xf numFmtId="167" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>',
    '<xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>',
    '<xf numFmtId="0" fontId="3" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>',
    '</cellXfs>',
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>',
    '<dxfs count="0"/>',
    '<tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>',
    '</styleSheet>'
  ].join("");
}

function xmlEntry(path: string, xml: string): ZipEntry {
  return {
    path,
    data: Buffer.from(xml, "utf8")
  };
}

function createZip(entries: ZipEntry[], now: Date) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const { dosTime, dosDate } = getDosDateTime(now);

  for (const entry of entries) {
    const filename = Buffer.from(entry.path, "utf8");
    const crc = crc32(entry.data);
    const localHeader = Buffer.alloc(30);

    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(entry.data.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(filename.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, filename, entry.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(entry.data.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(filename.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, filename);
    offset += localHeader.length + filename.length + entry.data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);

  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(offset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, endRecord]);
}

function createCrcTable() {
  return Array.from({ length: 256 }, (_, index) => {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    return value >>> 0;
  });
}

function crc32(data: Buffer) {
  let crc = 0xffffffff;

  for (const byte of data) {
    crc = (crcTable[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function getDosDateTime(date: Date) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();

  return { dosTime, dosDate };
}

function dateToExcelSerial(date: Date) {
  const excelEpoch = Date.UTC(1899, 11, 30);
  return (date.getTime() - excelEpoch) / 86_400_000;
}

function columnName(index: number) {
  let result = "";
  let current = index;

  while (current > 0) {
    current -= 1;
    result = String.fromCharCode(65 + (current % 26)) + result;
    current = Math.floor(current / 26);
  }

  return result;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
