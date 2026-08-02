// Ambient types for CSS Module imports so `import styles from './x.module.css'`
// is type-checked instead of erroring under `tsc --noEmit`.
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.module.scss' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

// pdf-parse is imported via its lib entry (see pdf-upload-routes.ts); type it here.
declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfParseResult {
    text: string;
    numpages: number;
    numrender: number;
    info: Record<string, any>;
    metadata: any;
    version: string;
  }
  function pdfParse(dataBuffer: Buffer, options?: Record<string, any>): Promise<PdfParseResult>;
  export default pdfParse;
}
