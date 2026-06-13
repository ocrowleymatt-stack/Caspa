/**
 * Input Hub Service
 * Handles multi-format input: PDFs, images, audio, text
 * Converges all materials into story spine extraction
 */

export interface InputSource {
  id: string;
  type: 'text' | 'pdf' | 'image' | 'audio';
  content: string; // extracted text
  originalFileName: string;
  uploadedAt: number;
  metadata: Record<string, any>;
}

export interface StorySpine {
  premise: string;
  mainConflict: string;
  keyThemes: string[];
  emotionalCore: string;
  suggestedGenre: string;
  characterSeeds: string[];
  settingSeeds: string[];
  plotPoints: string[];
}

class InputHub {
  /**
   * Extract text from PDF
   */
  async extractPdfText(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await import('pdfjs-dist');
      pdf.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdf.version}/pdf.worker.min.js`;

      const pdfdoc = await pdf.getDocument({ data: arrayBuffer }).promise;
      let text = '';

      for (let i = 1; i <= pdfdoc.numPages; i++) {
        const page = await pdfdoc.getPage(i);
        const textContent = await page.getTextContent();
        text += textContent.items.map((item: any) => item.str).join(' ') + '\n';
      }

      return text;
    } catch (error) {
      console.error('PDF extraction failed:', error);
      throw new Error('Failed to extract PDF text');
    }
  }

  /**
   * Extract text from image via OCR (Google Cloud Vision would be ideal)
   * For now, return placeholder - integrate with backend OCR service
   */
  async extractImageText(file: File): Promise<string> {
    // This should call a backend endpoint that uses Cloud Vision API
    // For MVP, return a note that OCR is needed
    return `[OCR needed for: ${file.name}]\n\nPlease integrate Google Cloud Vision API for automatic text extraction from handwritten notes and images.`;
  }

  /**
   * Transcribe audio to text
   * Should call backend endpoint with Google Cloud Speech-to-Text
   */
  async transcribeAudio(file: File): Promise<string> {
    // This should call a backend endpoint that uses Cloud Speech-to-Text API
    return `[Audio transcription needed for: ${file.name}]\n\nPlease integrate Google Cloud Speech-to-Text API for automatic transcription.`;
  }

  /**
   * Normalize text input
   */
  normalizeText(text: string): string {
    return text
      .trim()
      .replace(/\r\n/g, '\n')
      .replace(/\n\n\n+/g, '\n\n');
  }

  /**
   * Extract story spine from all input sources
   * Calls AI service to synthesize materials into narrative structure
   */
  async extractStorySpine(sources: InputSource[], aiService: any): Promise<StorySpine> {
    const combinedContent = sources.map(s => `[${s.type.toUpperCase()}: ${s.originalFileName}]\n${s.content}`).join('\n\n---\n\n');

    const prompt = `You are a narrative architect analyzing raw creative materials.

Given these chaotic inputs (notes, scraps, ideas, research), extract the story spine:

${combinedContent}

Respond with JSON containing:
{
  "premise": "One sentence essence of the story",
  "mainConflict": "The central tension",
  "keyThemes": ["theme1", "theme2", ...],
  "emotionalCore": "What emotion drives this story",
  "suggestedGenre": "Primary genre",
  "characterSeeds": ["Character concept 1", ...],
  "settingSeeds": ["Setting detail 1", ...],
  "plotPoints": ["Inciting incident", "Midpoint", "Climax", ...]
}`;

    const response = await aiService.generateContent(prompt);
    const text = response.response.text();

    try {
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Failed to parse story spine:', error);
      throw new Error('Failed to extract story spine from inputs');
    }
  }

  /**
   * Process multiple file uploads
   */
  async processFiles(files: File[]): Promise<InputSource[]> {
    const sources: InputSource[] = [];

    for (const file of files) {
      let content = '';
      const type = this.getFileType(file);

      try {
        if (type === 'pdf') {
          content = await this.extractPdfText(file);
        } else if (type === 'image') {
          content = await this.extractImageText(file);
        } else if (type === 'audio') {
          content = await this.transcribeAudio(file);
        } else if (type === 'text') {
          content = this.normalizeText(await file.text());
        }

        sources.push({
          id: `${Date.now()}-${Math.random()}`,
          type,
          content,
          originalFileName: file.name,
          uploadedAt: Date.now(),
          metadata: {
            size: file.size,
            mimeType: file.type,
          },
        });
      } catch (error) {
        console.error(`Failed to process ${file.name}:`, error);
        // Continue with other files, log errors
      }
    }

    return sources;
  }

  /**
   * Determine file type from MIME type
   */
  private getFileType(file: File): 'text' | 'pdf' | 'image' | 'audio' {
    if (file.type.startsWith('audio/')) return 'audio';
    if (file.type.startsWith('image/')) return 'image';
    if (file.type === 'application/pdf') return 'pdf';
    if (file.type.startsWith('text/')) return 'text';
    // Guess from extension
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext || '')) return 'audio';
    if (['png', 'jpg', 'jpeg', 'gif'].includes(ext || '')) return 'image';
    return 'text';
  }
}

export const inputHub = new InputHub();
