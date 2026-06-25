export interface PagePlan {
  pageNumber: number;
  spread: 'left' | 'right' | 'full';
  content: string;
  illustrationNote: string;
}

export class PagePlanEngine {
  plan(text: string, pagesPerChapter = 2): PagePlan[] {
    const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());
    const plans: PagePlan[] = [];
    let pageNum = 1;

    for (let i = 0; i < paragraphs.length; i += pagesPerChapter) {
      const chunk = paragraphs.slice(i, i + pagesPerChapter).join('\n\n');
      plans.push({
        pageNumber: pageNum,
        spread: pageNum % 2 === 1 ? 'right' : 'left',
        content: chunk.slice(0, 500),
        illustrationNote: `Visual beat for page ${pageNum}: focus on setting and character emotion.`,
      });
      pageNum++;
    }

    return plans;
  }
}

export const pagePlanEngine = new PagePlanEngine();
