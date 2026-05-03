import OpenAI from "openai";

let client: OpenAI | null = null;

export function getDeepSeek(): OpenAI {
  if (!client) {
    client = new OpenAI({
      baseURL: "https://api.deepseek.com",
      apiKey: process.env.DEEPSEEK_API_KEY ?? "",
    });
  }
  return client;
}
