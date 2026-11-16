// Browser-only PDF text extraction with PDF.js (loaded lazily).
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  // Pass verbosity: 0 (ERRORS only) to suppress non-fatal TrueType font hinting warnings (e.g. TT: undefined function: 32)
  const doc = await pdfjs.getDocument({
    data: await file.arrayBuffer(),
    verbosity: 0,
    stopAtErrors: false,
  }).promise;

  let out = "";
  for (let i = 1; i <= Math.min(doc.numPages, 60); i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    out += `\n[Page ${i}]\n` + tc.items.map((it: any) => it.str).join(" ");
    if (out.length > 60000) break;
  }
  return out.replace(/[ \t]+/g, " ").trim();
}
