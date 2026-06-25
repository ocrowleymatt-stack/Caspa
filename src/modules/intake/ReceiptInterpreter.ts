import type { ClassifiedSource } from './SourceClassifier';

export interface ReceiptInterpretation {
  vendor?: string;
  date?: string;
  total?: string;
  items: string[];
  notes: string;
}

export class ReceiptInterpreter {
  interpret(content: string, classification: ClassifiedSource): ReceiptInterpretation | null {
    if (classification.type !== 'receipt') return null;

    const totalMatch = content.match(/(?:total|amount)[:\s]*[£$]?([\d,.]+)/i);
    const dateMatch = content.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
    const vendorMatch = content.match(/^([A-Z][A-Za-z\s&]+)/m);

    return {
      vendor: vendorMatch?.[1]?.trim(),
      date: dateMatch?.[1],
      total: totalMatch?.[1],
      items: content.split('\n').filter((l) => l.trim().length > 3 && !/total/i.test(l)).slice(0, 10),
      notes: 'Receipt parsed locally — no external OCR service connected.',
    };
  }
}

export const receiptInterpreter = new ReceiptInterpreter();
