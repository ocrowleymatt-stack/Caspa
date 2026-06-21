import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = '/opt/caspa/data/service-jobs';
const JOB_RETENTION_DAYS = 7;

export class JobMonitorService {
  async getJobMetrics(): Promise<any> {
    const jobsDir = DATA_DIR;
    if (!fs.existsSync(jobsDir)) {
      return {
        totalJobs: 0,
        byStatus: {},
        avgProcessingTime: 0,
        totalDataSize: '0 MB'
      };
    }

    const items = fs.readdirSync(jobsDir);
    const byStatus: any = {};
    let totalTime = 0;
    let totalSize = 0;
    let jobCount = 0;

    for (const item of items) {
      const itemPath = path.join(jobsDir, item);
      const stat = fs.statSync(itemPath);

      // Try to read metadata
      let meta: any = { status: 'unknown' };
      if (stat.isFile() && item.endsWith('.json')) {
        try {
          meta = JSON.parse(fs.readFileSync(itemPath, 'utf8'));
          jobCount++;
          byStatus[meta.status] = (byStatus[meta.status] || 0) + 1;
          if (meta.startTime && meta.endTime) {
            totalTime += meta.endTime - meta.startTime;
          }
          totalSize += stat.size;
        } catch (e) {
          // Skip malformed JSON
        }
      } else if (stat.isDirectory()) {
        jobCount++;
        byStatus[meta.status] = (byStatus[meta.status] || 0) + 1;
        totalSize += this.getDirectorySize(itemPath);
      }
    }

    return {
      totalJobs: jobCount,
      byStatus,
      avgProcessingTime: jobCount > 0 ? Math.round(totalTime / jobCount) : 0,
      totalDataSize: `${(totalSize / 1024 / 1024).toFixed(2)} MB`
    };
  }

  async cleanupExpiredJobs(): Promise<{ deleted: number; freed: string }> {
    const jobsDir = DATA_DIR;
    if (!fs.existsSync(jobsDir)) return { deleted: 0, freed: '0 MB' };

    const cutoffTime = Date.now() - JOB_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const items = fs.readdirSync(jobsDir);

    let deleted = 0;
    let freedBytes = 0;

    for (const item of items) {
      const itemPath = path.join(jobsDir, item);
      const stat = fs.statSync(itemPath);

      if (stat.mtime.getTime() < cutoffTime) {
        let size = 0;
        if (stat.isDirectory()) {
          size = this.getDirectorySize(itemPath);
          fs.rmSync(itemPath, { recursive: true });
        } else {
          size = stat.size;
          fs.unlinkSync(itemPath);
        }
        deleted++;
        freedBytes += size;
      }
    }

    return {
      deleted,
      freed: `${(freedBytes / 1024 / 1024).toFixed(2)} MB`
    };
  }

  private getDirectorySize(dir: string): number {
    let size = 0;
    if (!fs.existsSync(dir)) return 0;
    
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      try {
        if (file.isDirectory()) {
          size += this.getDirectorySize(fullPath);
        } else {
          size += fs.statSync(fullPath).size;
        }
      } catch (e) {
        // Skip errors on individual files
      }
    }
    return size;
  }
}
