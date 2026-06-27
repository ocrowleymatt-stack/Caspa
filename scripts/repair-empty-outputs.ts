#!/usr/bin/env tsx
/**
 * Repair outputs missing canonical metadata.text
 * Usage:
 *   npm run repair:outputs -- --dry-run
 *   npm run repair:outputs
 */
import { listJsonFiles, readJsonFile, writeJsonFile } from '../src/shared/fileStore';
import {
  extractOutputText,
  normalizeOutputMetadata,
  outputHasText,
} from '../src/shared/outputSemantics';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const files = await listJsonFiles('outputs');
  let repaired = 0;
  let unrecoverable = 0;
  let skipped = 0;

  for (const file of files) {
    const record = await readJsonFile<{
      id: string;
      type: string;
      metadata: Record<string, unknown>;
    }>('outputs', file);
    if (!record) continue;

    if (outputHasText(record.metadata)) {
      skipped += 1;
      continue;
    }

    const before = extractOutputText(record.metadata);
    const normalised = normalizeOutputMetadata(record.metadata, { type: record.type });

    if (!normalised.hasText) {
      normalised.unrecoverable = true;
      normalised.unrecoverableReason = 'No readable text found in metadata fallbacks';
      unrecoverable += 1;
      console.log(`UNRECOVERABLE ${record.id} (${record.type})`);
    } else {
      repaired += 1;
      console.log(`REPAIR ${record.id} (${record.type}) ${before ? 'had partial' : 'empty'} → ${String(normalised.wordCount)} words`);
    }

    if (!DRY_RUN) {
      await writeJsonFile('outputs', file, {
        ...record,
        metadata: normalised,
      });
    }
  }

  console.log(`\nDone${DRY_RUN ? ' (dry run)' : ''}: repaired=${repaired}, unrecoverable=${unrecoverable}, skipped=${skipped}, total=${files.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
