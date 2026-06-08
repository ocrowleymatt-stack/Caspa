import { AIService } from './src/services/ai.js';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  try {
    const res = await AIService.compileResearch("Mars Rovers", "Mars colonisation", "novel", true);
    console.log(res);
  } catch (e) {
    console.error("ERROR", e);
  }
}
test();
