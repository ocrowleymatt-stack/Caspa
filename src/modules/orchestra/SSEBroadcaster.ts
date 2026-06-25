import type { Response } from 'express';
import { eventBus, type JobStatus } from '../../shared';

interface SseClient {
  res: Response;
  filter?: { jobId?: string };
}

export class SSEBroadcaster {
  private clients = new Set<SseClient>();

  constructor() {
    eventBus.on('job:queued', (job) => this.broadcastJobUpdate(job));
    eventBus.on('job:progress', (job) => this.broadcastJobUpdate(job));
    eventBus.on('job:complete', (job) => this.broadcastJobUpdate(job));
    eventBus.on('job:failed', (job) => this.broadcastJobUpdate(job));
  }

  addClient(res: Response, filter?: { jobId?: string }): void {
    const client: SseClient = { res, filter };
    this.clients.add(client);

    res.on('close', () => {
      this.removeClient(res);
    });
  }

  removeClient(res: Response): void {
    for (const client of this.clients) {
      if (client.res === res) {
        this.clients.delete(client);
        break;
      }
    }
  }

  broadcast(event: string, data: unknown): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

    for (const client of this.clients) {
      if (!client.res.writableEnded) {
        client.res.write(payload);
      }
    }
  }

  broadcastJobUpdate(job: JobStatus): void {
    const data = {
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      result: job.result,
      error: job.error,
    };

    for (const client of this.clients) {
      if (client.filter?.jobId && client.filter.jobId !== job.id) {
        continue;
      }

      if (!client.res.writableEnded) {
        client.res.write(`event: job-update\ndata: ${JSON.stringify(data)}\n\n`);
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

export const sseBroadcaster = new SSEBroadcaster();
