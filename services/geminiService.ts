
import { GoogleGenAI, Modality } from '@google/genai';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const transcribeAudio = async (audioBase64: string, mimeType: string): Promise<string> => {
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

  const response = await ai.models.generateContent({
    model,
    contents: { parts: [audioPart, textPart] },
  });

  return response.text;
};

export const translateText = async (text: string, targetLanguage: string): Promise<string> => {
  const model = 'gemini-2.5-flash';
  const prompt = `Translate the following English text into ${targetLanguage}. Maintain a similar character count, tone, and style. Only provide the translated text, without any additional comments or explanations.

English Text:
---
${text}
---
`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  return response.text;
};

export const generateSpeech = async (text: string): Promise<string> => {
  const model = "gemini-2.5-flash-preview-tts";
  const response = await ai.models.generateContent({
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
