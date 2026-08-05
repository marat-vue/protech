import { describe, expect, it } from "vitest";
import { createXlsxWorkbook } from "../server/utils/xlsx";

describe("xlsx workbook generator", () => {
  it("creates a readable OpenXML zip with escaped sheet content", () => {
    const workbook = createXlsxWorkbook([
      {
        name: "Продажи/Склад",
        freezeRows: 1,
        autoFilterRow: 1,
        columns: [{ width: 24 }, { width: 12 }],
        rows: [
          [{ value: "Название & SKU", style: "header" }, { value: "Остаток", style: "header" }],
          ["Фильтр <A>", { value: 12, style: "integer" }]
        ]
      }
    ]);

    expect(workbook.readUInt32LE(0)).toBe(0x04034b50);
    expect(listZipEntries(workbook)).toEqual(expect.arrayContaining([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/styles.xml",
      "xl/worksheets/sheet1.xml"
    ]));
    expect(readZipEntry(workbook, "xl/workbook.xml")).toContain('name="Продажи Склад"');

    const sheetXml = readZipEntry(workbook, "xl/worksheets/sheet1.xml");

    expect(sheetXml).toContain("Название &amp; SKU");
    expect(sheetXml).toContain("Фильтр &lt;A&gt;");
    expect(sheetXml).toContain('ySplit="1"');
    expect(sheetXml).toContain('<autoFilter ref="A1:B2"/>');
  });
});

function listZipEntries(buffer: Buffer) {
  return iterateLocalZipEntries(buffer).map((entry) => entry.name);
}

function readZipEntry(buffer: Buffer, targetName: string) {
  const entry = iterateLocalZipEntries(buffer).find(({ name }) => name === targetName);

  if (!entry) {
    throw new Error(`Zip entry not found: ${targetName}`);
  }

  return buffer.subarray(entry.dataStart, entry.dataEnd).toString("utf8");
}

function iterateLocalZipEntries(buffer: Buffer) {
  const entries: Array<{ name: string; dataStart: number; dataEnd: number }> = [];
  let offset = 0;

  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const compressionMethod = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const filenameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + filenameLength + extraLength;
    const dataEnd = dataStart + compressedSize;

    if (compressionMethod !== 0) {
      throw new Error(`Unsupported compression method: ${compressionMethod}`);
    }

    entries.push({
      name: buffer.subarray(nameStart, nameStart + filenameLength).toString("utf8"),
      dataStart,
      dataEnd
    });
    offset = dataEnd;
  }

  return entries;
}
