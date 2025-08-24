import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export function setupPdfjsWorker() {
  (pdfjs as any).GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs;
}