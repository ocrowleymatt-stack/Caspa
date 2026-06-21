import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execPromise = promisify(exec);

export interface CMYKValidationResult {
  isValid: boolean;
  colorSpace: 'RGB' | 'CMYK' | 'GrayScale' | 'Unknown';
  hasICCProfile: boolean;
  iccProfileType?: string;
  warnings: string[];
  recommendedAction: 'convert' | 'pass' | 'reject';
  conversionRequired: boolean;
}

/**
 * CMYK Validator: Checks if a PDF is print-ready
 * - Detects color space (RGB vs CMYK)
 * - Validates ICC profiles
 * - Recommends RGB→CMYK conversion
 */
export class CMYKValidator {
  /**
   * Validate PDF for print readiness
   */
  async validatePDF(pdfPath: string): Promise<CMYKValidationResult> {
    try {
      const { stdout } = await execPromise(`file "${pdfPath}"`);
      const warnings: string[] = [];
      let colorSpace: 'RGB' | 'CMYK' | 'GrayScale' | 'Unknown' = 'Unknown';
      let hasICCProfile = false;
      let iccProfileType: string | undefined;

      // Use ImageMagick to inspect PDF
      try {
        const infoCmd = `identify -verbose "${pdfPath}" 2>/dev/null || true`;
        const { stdout: identifyOutput } = await execPromise(infoCmd);

        // Parse color space
        if (identifyOutput.includes('CMYK')) {
          colorSpace = 'CMYK';
        } else if (identifyOutput.includes('RGB')) {
          colorSpace = 'RGB';
          warnings.push('PDF uses RGB color space; will be converted to CMYK for print');
        } else if (identifyOutput.includes('Gray')) {
          colorSpace = 'GrayScale';
        }

        // Check for ICC profile
        if (identifyOutput.includes('ICC')) {
          hasICCProfile = true;
          if (identifyOutput.includes('sRGB')) {
            iccProfileType = 'sRGB';
          } else if (identifyOutput.includes('Adobe')) {
            iccProfileType = 'Adobe RGB';
          } else if (identifyOutput.includes('Display')) {
            iccProfileType = 'Display P3';
          } else {
            iccProfileType = 'Generic';
          }
        }

        if (!hasICCProfile && colorSpace !== 'CMYK') {
          warnings.push('No ICC profile detected; consider embedding one for accurate color reproduction');
        }
      } catch (e) {
        warnings.push('Unable to fully inspect PDF; proceeding with basic validation');
      }

      // Determine recommended action
      const conversionRequired = colorSpace === 'RGB';
      let recommendedAction: 'convert' | 'pass' | 'reject' = 'pass';

      if (colorSpace === 'RGB') {
        recommendedAction = 'convert';
      } else if (colorSpace === 'Unknown') {
        recommendedAction = 'reject';
        warnings.push('Cannot determine color space; PDF may be corrupted');
      }

      return {
        isValid: colorSpace !== 'Unknown',
        colorSpace,
        hasICCProfile,
        iccProfileType,
        warnings,
        recommendedAction,
        conversionRequired,
      };
    } catch (error) {
      return {
        isValid: false,
        colorSpace: 'Unknown',
        hasICCProfile: false,
        warnings: [error instanceof Error ? error.message : 'Unknown validation error'],
        recommendedAction: 'reject',
        conversionRequired: false,
      };
    }
  }

  /**
   * Convert RGB PDF to CMYK
   * Uses ImageMagick's convert command
   */
  async convertRGBToCMYK(inputPath: string, outputPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Ensure output directory exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Use ImageMagick to convert
      // -colorspace CMYK converts the color space
      // -density 300 maintains print quality
      // -quality 95 preserves clarity
      const cmd = `convert "${inputPath}" -colorspace CMYK -density 300 -quality 95 "${outputPath}"`;

      await execPromise(cmd, { timeout: 30000 });

      // Verify output
      if (!fs.existsSync(outputPath)) {
        throw new Error('Conversion produced no output file');
      }

      const stats = fs.statSync(outputPath);
      if (stats.size < 1000) {
        throw new Error('Output file suspiciously small; conversion may have failed');
      }

      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `CMYK conversion failed: ${msg}` };
    }
  }

  /**
   * Embed ICC profile in PDF
   */
  async embedICCProfile(pdfPath: string, iccProfilePath: string, outputPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Use convert to embed ICC profile
      const cmd = `convert "${pdfPath}" -profile "${iccProfilePath}" "${outputPath}"`;
      await execPromise(cmd, { timeout: 30000 });

      if (!fs.existsSync(outputPath)) {
        throw new Error('Profile embedding produced no output');
      }

      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `ICC profile embedding failed: ${msg}` };
    }
  }
}

export default new CMYKValidator();
