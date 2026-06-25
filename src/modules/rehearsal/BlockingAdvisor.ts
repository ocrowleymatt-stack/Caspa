import { showFactoryService } from '../show-factory';

export interface BlockingAdvice {
  showPackageId: string;
  scenes: { scene: string; blocking: string; props: string[] }[];
  trafficNotes: string[];
  generatedAt: string;
}

export class BlockingAdvisor {
  async advise(showPackageId: string): Promise<BlockingAdvice> {
    const pkg = await showFactoryService.getShowPackage(showPackageId);
    const sceneCount = Math.max(3, pkg.components.length);

    return {
      showPackageId,
      scenes: Array.from({ length: Math.min(sceneCount, 6) }, (_, i) => ({
        scene: `Scene ${i + 1}`,
        blocking: i % 2 === 0 ? 'Downstage centre focus, ensemble upstage' : 'Traverse staging — audience on both sides',
        props: i === 0 ? ['Table', 'Letters'] : ['Chair', 'Coat'],
      })),
      trafficNotes: ['Cross stage left to right during exposition', 'Avoid upstage crossings during intimate dialogue'],
      generatedAt: new Date().toISOString(),
    };
  }
}

export const blockingAdvisor = new BlockingAdvisor();
