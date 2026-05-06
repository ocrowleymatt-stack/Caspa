import { AIService } from "./src/services/ai";
import dotenv from "dotenv";
dotenv.config();

async function run() {
  const project: any = {
    id: "1",
    title: "Test",
    type: "novel",
    maturity: "standard",
    genre: "fantasy",
    premise: "A hero saves the world",
    tone: "dark",
    sourceMaterials: []
  };
  const research: any[] = [{
      id: "1",
      title: "My custom plot beat",
      content: "The hero finds a glowing magical artifact.",
      category: "AI Brainstorm",
      tags: [],
      updatedAt: Date.now(),
      isDeepResearch: false
  }];
  try {
    const nodes = await AIService.outlinePlotNodes(project, [], research);
    console.log("nodes:", nodes.length);
  } catch (e: any) {
    console.error("ERROR:", e.message || e);
  }
}
run();
