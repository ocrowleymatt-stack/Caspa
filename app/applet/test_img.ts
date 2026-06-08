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
      contents: {
        parts: [{ text: "a happy red dog" }]
      },
        config: {
          // @ts-ignore
          imageConfig: {
            aspectRatio: "3:4"
          }
        }
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
         if ((part as any).inlineData) {
            console.log("MimeType: ", (part as any).inlineData.mimeType);
            console.log("Found inline data!");
            return;
         }
      }
    } 
    console.log("No inline data found");
  } catch (e: any) {
    console.error(e.message || e);
  }
}
run();
