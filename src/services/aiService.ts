import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function getInventoryForecast(items: any[]) {
  try {
    const prompt = `Analyze this inventory data and provide a forecast for the next 30 days. 
    Identify items at risk of stockout, suggest reorder quantities, and note any trends.
    Return the analysis in a structured JSON format.
    
    Inventory Data: ${JSON.stringify(items.map(i => ({ name: i.name, quantity: i.quantity, threshold: i.reorderThreshold, price: i.price })))}
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  itemName: { type: Type.STRING },
                  action: { type: Type.STRING },
                  reason: { type: Type.STRING }
                }
              }
            },
            riskLevel: { type: Type.STRING, description: "Low, Medium, or High" }
          }
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Forecasting error:", error);
    return { summary: "Unable to generate forecast at this time.", recommendations: [], riskLevel: "Unknown" };
  }
}
