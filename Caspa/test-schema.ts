import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function run() {
  const schema = {
    type: Type.OBJECT,
    properties: {
      nodes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            type: { type: Type.STRING }
          },
          required: ["title", "description", "type"]
        }
      }
    },
    required: ["nodes"]
  };

  try {
    const res = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Tell me a story with 3 plot points.",
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });
    console.log("SUCCESS:", res.text);
  } catch (e: any) {
    console.log("ERROR:", e.message || e);
  }
}
run();
