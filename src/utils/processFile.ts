export type ProcessedFile = {
  text: string;
  meta: {
    name: string;
    size: number;
    type: string;
    ext: string;
    pages?: number;
    sheets?: string[];
    truncated?: boolean;
  };
};

const MAX_BYTES = 20 * 1024 * 1024; // 20MB
const MAX_CHARS = 200_000;
const SUPPORTED_EXTS = ['.txt', '.csv', '.xls', '.xlsx', '.pdf']; // habilite '.docx' depois

const getExt = (name: string) => '.' + (name.split('.').pop()?.toLowerCase() || '');
const normalize = (s: string) =>
  s.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

export async function processFile(file: File): Promise<ProcessedFile> {
  if (file.size > MAX_BYTES) {
    throw new Error(`Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Limite: ${MAX_BYTES / 1024 / 1024}MB`);
  }
  const ext = getExt(file.name);
  if (!SUPPORTED_EXTS.includes(ext)) {
    throw new Error(`Tipo de arquivo não suportado: ${ext}`);
  }

  // TXT/CSV
  if (ext === '.txt' || ext === '.csv') {
    const buff = await file.arrayBuffer();
    const text = new TextDecoder('utf-8', { fatal: false }).decode(buff);
    const out = normalize(text).slice(0, MAX_CHARS);
    return { text: out, meta: { name: file.name, size: file.size, type: file.type, ext, truncated: out.length >= MAX_CHARS } };
  }

  // XLS/XLSX
  if (ext === '.xls' || ext === '.xlsx') {
    const XLSX = await import('xlsx');
    const data = new Uint8Array(await file.arrayBuffer());
    const wb = XLSX.read(data, { type: 'array' });
    const sheets: string[] = [];
    let all = '';
    for (const sn of wb.SheetNames) {
      sheets.push(sn);
      const ws = wb.Sheets[sn];
      const csv = XLSX.utils.sheet_to_csv(ws);
      all += `\n--- ${sn} ---\n${csv}\n`;
      if (all.length > MAX_CHARS) break;
    }
    const out = normalize(all).slice(0, MAX_CHARS);
    return { text: out, meta: { name: file.name, size: file.size, type: file.type, ext, sheets, truncated: out.length >= MAX_CHARS } };
  }

  // PDF (usa o worker configurado)
  if (ext === '.pdf') {
    const { setupPdfjsWorker } = await import('./pdfWorker');
    const pdfjs: any = setupPdfjsWorker();

    const ab = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: ab });
    const pdf = await loadingTask.promise;

    const maxPages = Math.min(pdf.numPages, 50);
    let text = `PDF: ${file.name} | Páginas: ${pdf.numPages}\n\n`;

    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const t = (content.items as any[]).map(it => (typeof (it as any).str === 'string' ? (it as any).str : '')).join(' ');
      text += `\n--- Página ${i} ---\n${t}\n`;
      if (text.length > MAX_CHARS) break;
    }

    const out = normalize(text).slice(0, MAX_CHARS);
    return { text: out, meta: { name: file.name, size: file.size, type: file.type, ext, pages: pdf.numPages, truncated: out.length >= MAX_CHARS } };
  }

  // DOCX (opcional — descomente quando quiser habilitar)
  // if (ext === '.docx') {
  //   const mammoth = await import('mammoth');
  //   const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() } as any);
  //   const out = normalize(value).slice(0, MAX_CHARS);
  //   return { text: out, meta: { name: file.name, size: file.size, type: file.type, ext, truncated: out.length >= MAX_CHARS } };
  // }

  throw new Error(`Extensão não tratada: ${ext}`);
}