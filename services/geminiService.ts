
import { GoogleGenAI, Modality } from '@google/genai';

let ai: GoogleGenAI | undefined;

function getAiClient(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      // This error will be caught by the UI and displayed to the user.
      throw new Error("API Key not found. Please ensure it is configured in your Vercel deployment's environment variables.");
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}


export const transcribeAudio = async (audioBase64: string, mimeType: string): Promise<string> => {
  const aiClient = getAiClient();
  const model = 'gemini-2.5-flash';
  const audioPart = {
    inlineData: {
      data: audioBase64,
      mimeType,
    },
  };
  const textPart = {
    text: "Transcribe this audio recording into English text. Provide only the transcribed text, without any additional comments, headers, or explanations.",
  };

  const response = await aiClient.models.generateContent({
    model,
    contents: { parts: [audioPart, textPart] },
  });

  return response.text;
};

export const translateText = async (text: string, targetLanguage: string): Promise<string> => {
  const aiClient = getAiClient();
  const model = 'gemini-2.5-flash';
  const prompt = `Translate the following English text into ${targetLanguage}. Maintain a similar character count, tone, and style. Only provide the translated text, without any additional comments or explanations.

English Text:
---
${text}
---
`;

  const response = await aiClient.models.generateContent({
    model,
    contents: prompt,
  });

  return response.text;
};

export const generateSpeech = async (text: string): Promise<string> => {
  const aiClient = getAiClient();
  const model = "gemini-2.5-flash-preview-tts";
  const response = await aiClient.models.generateContent({
    model,
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' }, // A male voice
        },
      },
    },
  });

  const audioPart = response.candidates?.[0]?.content?.parts?.[0];
  if (audioPart && audioPart.inlineData?.data) {
    return audioPart.inlineData.data;
  }
  
  throw new Error("Could not generate audio from the provided text.");
};