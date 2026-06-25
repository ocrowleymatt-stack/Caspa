import { requireProject } from '../../shared/elevationHelpers';

export class CommunityReferenceAdapter {
  async adaptProject(projectId: string, community: string) {
    const project = await requireProject(projectId);
    return {
      projectId,
      community,
      references: [
        `Local landmark echo in opening scene — ${community}`,
        `Community festival as backdrop for Act Two`,
        `Regional dialect note for supporting characters`,
      ],
      generatedAt: new Date().toISOString(),
    };
  }
}

export const communityReferenceAdapter = new CommunityReferenceAdapter();
