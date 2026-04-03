import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function analyzeMeal(base64Images: string[]) {
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash"
    });

    const prompt = `
Analyze these images as a FITNESS meal.

Only choose from:
rice, chicken, eggs, fish, tuna, plantain, sweet potato, spaghetti, beans.

Return ONLY JSON:
[
  { "name": "rice", "portion_g": 200 }
]
`;

    const imageParts = base64Images.map((base64) => ({
        inlineData: {
            data: base64,
            mimeType: "image/jpeg"
        }
    }));

    const result = await model.generateContent([
        prompt,
        ...imageParts
    ]);

    const text = result.response.text();

    return text;
}