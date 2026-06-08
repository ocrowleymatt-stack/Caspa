import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.log("No API key");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
async function run() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: "a happy red dog",
      config: {
        // @ts-ignore
        outputMimeType: "image/png",
        imageConfig: {
          aspectRatio: "3:4"
        }
      }
    });

    console.log("Candidates length:", response.candidates?.length);
    console.log(JSON.stringify(response.candidates?.[0]?.content?.parts, null, 2));

  } catch (e) {
    console.error(e);
  }
}
run();
