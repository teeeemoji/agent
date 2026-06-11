import type { IProvider } from "./types.js"
import { OpenAIProvider } from "./openai-provider.js"
import { AnthropicProvider } from "./anthropic-provider.js"
import { getAuthManager } from "./auth-manager.js"

export interface ProviderConfig {
  provider: string
  model?: string
}

const DEFAULT_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  deepseek: "https://api.deepseek.com/v1",
  groq: "https://api.groq.com/openai/v1",
  openrouter: "https://openrouter.ai/api/v1",
  ollama: "http://localhost:11434/v1",
}

export function createProvider(config: ProviderConfig): IProvider {
  const auth = getAuthManager()
  const apiKey = auth.getApiKey(config.provider)
  const baseURL = auth.getBaseURL(config.provider)
    ?? DEFAULT_BASE_URLS[config.provider]
  const model = config.model ?? config.provider

  if (config.provider === "openai") {
    return new OpenAIProvider({
      apiKey,
      baseURL: baseURL ?? DEFAULT_BASE_URLS.openai,
      model,
    })
  }

  if (config.provider === "anthropic") {
    return new AnthropicProvider({
      apiKey,
      model,
      baseURL,
    })
  }

  if (
    config.provider === "deepseek" ||
    config.provider === "groq" ||
    config.provider === "openrouter" ||
    config.provider === "ollama"
  ) {
    if (!apiKey && config.provider !== "ollama") {
      throw new Error(
        `Provider "${config.provider}" 缺少 API Key。请设置对应的环境变量或在 auth.json 中配置。`
      )
    }
    return new OpenAIProvider({
      apiKey,
      baseURL: baseURL ?? DEFAULT_BASE_URLS[config.provider] ?? "https://api.openai.com/v1",
      model,
    })
  }

  throw new Error(`未知的 Provider 类型: "${config.provider}"`)
}
