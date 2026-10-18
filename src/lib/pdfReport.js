// Reads stock-report PDFs (e.g. the Infor "Item List By Manufacturer" report) in the browser.
// Each printed line looks like:
//   D0065071   LAMP   EA Each   3.000000   020724   2034-12-31   A202   Jeddah Service
//   item code  description / unit   on hand   lot   expiry (optional)   warehouse   warehouse name
// Reading the text directly keeps every row; AI extraction can drop rows on long reports.

const ROW = /^(\S+)\s+.*?\s(-?[\d,]+\.\d{3,})\s+(\S*?)\s*(\d{4}-\d{2}-\d{2})?\s+(\S+)\s+(.*)$/;
const ITEM_CODE = /^[a-z]{1,6}\d[\w/.-]*$/i;

async function loadPdfJs() {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    // @ts-ignore Vite "?url" import
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

// Text of every printed line, top to bottom, page by page.
async function pdfLines(data) {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data }).promise;
  const lines = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const { items } = await (await doc.getPage(p)).getTextContent();
    const byY = new Map();
    for (const it of /** @type {any[]} */ (items)) {
      if (!it.str || !it.str.trim()) continue;
      const y = Math.round(it.transform[5]);
      if (!byY.has(y)) byY.set(y, []);
      byY.get(y).push({ x: it.transform[4], str: it.str });
    }
    [...byY.entries()]
      .sort((a, b) => b[0] - a[0])
      .forEach(([, parts]) => lines.push(parts.sort((a, b) => a.x - b.x).map(t => t.str.trim()).join(' ')));
  }
  return lines;
}

// Parses an array of text lines into report rows using the known report layout.
// Returns null when the lines don't match the layout (the caller then uses AI extraction).
function parseLines(lines) {
  const candidates = lines.filter(l => ITEM_CODE.test(l.split(/\s+/)[0]));
  const rows = [];
  for (const line of candidates) {
    const m = line.match(ROW);
    if (!m) continue;
    rows.push({
      item_code: m[1],
      quantity: Number(m[2].replace(/,/g, '')) || 0,
      warehouse: m[5],
      warehouse_name: m[6].trim(),
    });
  }
  // Only trust the layout when (nearly) every item line was understood.
  if (rows.length === 0 || rows.length < candidates.length * 0.9) return null;
  return rows;
}

// Returns report rows, or null when the PDF does not have this layout (the caller then uses AI extraction).
export async function parsePdfReport(data) {
  return parseLines(await pdfLines(data));
}

// Parses a plain-text stock report (same line layout as the PDF report).
export function parseTxtReport(text) {
  return parseLines(text.split(/\r?\n/));
}