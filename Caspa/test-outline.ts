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
  try {
    const nodes = await AIService.outlinePlotNodes(project, [], []);
    console.log("SUCCESS");
  } catch (e: any) {
    console.error("ERROR:", e.message || e);
  }
}
run();
