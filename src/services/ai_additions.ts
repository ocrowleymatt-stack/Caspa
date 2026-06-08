// ─────────────────────────────────────────────────────────────────────────────
// SEED INGESTION: Any raw input → collaborative story proposal
// ─────────────────────────────────────────────────────────────────────────────
export async function seedToStory(
  rawSeed: string,
  seedType: 'text' | 'image_ocr' | 'voice_transcript' | 'url' = 'text',
  callAIFn: (opts: any) => Promise<string>,
  TypeEnum: any
): Promise<{
  title: string;
  premise: string;
  genre: string;
  tone: string;
  type: string;
  targetWordCount: number;
  logline: string;
  centralWound: string;
  suggestedChapters: { title: string; summary: string }[];
  suggestedCharacters: { name: string; role: string; backstory: string }[];
  authorQuestions: string[];
  prizeTarget: string;
}> {
  const prompt = `
YOU ARE A WORLD-CLASS LITERARY EDITOR AND STORY ARCHITECT.

A raw seed has been provided. Your job is to find the STORY INSIDE IT — the hidden wound, the dramatic engine, the human truth — and propose a full literary project from it.

SEED TYPE: ${seedType}
RAW SEED:
${rawSeed.slice(0, 8000)}

CRITICAL PHILOSOPHY:
- Every seed contains a story. A receipt on the floor contains a life. A voice note contains a confession. Find it.
- The ambition is ALWAYS literary prize quality. Think Booker, Pulitzer, Costa.
- Do NOT produce a generic plot. Find the SPECIFIC, STRANGE, HUMAN truth in this seed.
- The story should feel inevitable once you see it — but surprising when proposed.
- Suggest 5 AUTHOR QUESTIONS that will unlock the story further. These are the questions that pull the author INTO the process.

Return JSON with:
- title: A working title (evocative, not generic)
- premise: 2-3 sentences. The dramatic engine. What is at stake and why it matters.
- genre: The primary genre
- tone: The tonal register (e.g. "Dry wit, melancholic undertow, Carver-esque restraint")
- type: One of: novel|screenplay|stageplay|radioplay|legal|academic|experimental|coursebook|subject_bible|cookbook|illustrated
- targetWordCount: Appropriate word count for the type and ambition
- logline: One sentence. The hook.
- centralWound: The hidden wound at the heart of the story.
- suggestedChapters: Array of 10-20 chapters with title and summary
- suggestedCharacters: Array of 3-6 characters with name, role, backstory
- authorQuestions: Array of 5 questions to ask the author to deepen the story
- prizeTarget: Which literary prize this could realistically target and why
`;

  const schema = {
    type: TypeEnum.OBJECT,
    properties: {
      title: { type: TypeEnum.STRING },
      premise: { type: TypeEnum.STRING },
      genre: { type: TypeEnum.STRING },
      tone: { type: TypeEnum.STRING },
      type: { type: TypeEnum.STRING },
      targetWordCount: { type: TypeEnum.NUMBER },
      logline: { type: TypeEnum.STRING },
      centralWound: { type: TypeEnum.STRING },
      suggestedChapters: {
        type: TypeEnum.ARRAY,
        items: {
          type: TypeEnum.OBJECT,
          properties: {
            title: { type: TypeEnum.STRING },
            summary: { type: TypeEnum.STRING }
          },
          required: ['title', 'summary']
        }
      },
      suggestedCharacters: {
        type: TypeEnum.ARRAY,
        items: {
          type: TypeEnum.OBJECT,
          properties: {
            name: { type: TypeEnum.STRING },
            role: { type: TypeEnum.STRING },
            backstory: { type: TypeEnum.STRING }
          },
          required: ['name', 'role', 'backstory']
        }
      },
      authorQuestions: { type: TypeEnum.ARRAY, items: { type: TypeEnum.STRING } },
      prizeTarget: { type: TypeEnum.STRING }
    },
    required: ['title', 'premise', 'genre', 'tone', 'type', 'targetWordCount', 'logline', 'centralWound', 'suggestedChapters', 'suggestedCharacters', 'authorQuestions', 'prizeTarget']
  };

  const response = await callAIFn({ prompt, json: true, schema, model: 'gemini-2.5-pro-preview-05-06' });
  if (typeof response === 'string') {
    return JSON.parse(response);
  }
  return response as any;
}
