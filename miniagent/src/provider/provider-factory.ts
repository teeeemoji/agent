import type { IProvider } from "./types.js"
import { OpenAIProvider } from "./openai-provider.js"

export interface ProviderConfig {
  provider: string
  model?: string
}

export function createProvider(config: ProviderConfig): IProvider {
  if (config.provider === "openai") {
    return new OpenAIProvider({
      apiKey: process.env.OPENAI_API_KEY ?? "",
      baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      model: config.model ?? process.env.OPENAI_MODEL ?? "gpt-4o",
    })
  }

  throw new Error(`未知的 Provider 类型: "${config.provider}"`)
}
