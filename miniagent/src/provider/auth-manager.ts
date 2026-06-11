import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import type { AuthInfo, AuthSource, ProviderName } from "./types.js"

const PROVIDER_ENV_KEY_MAP: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  groq: "GROQ_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
}

const PROVIDER_ENV_BASE_URL_MAP: Record<string, string> = {
  openai: "OPENAI_BASE_URL",
  anthropic: "ANTHROPIC_BASE_URL",
  google: "GOOGLE_BASE_URL",
  deepseek: "DEEPSEEK_BASE_URL",
  groq: "GROQ_BASE_URL",
  openrouter: "OPENROUTER_BASE_URL",
}

const NO_AUTH_PROVIDERS = new Set(["ollama", "lmstudio", "vllm"])

function getAuthFilePath(): string {
  const dataDir = process.env.OPENAUTH_DATA_DIR
    ?? path.join(os.homedir(), ".miniagent")
  return path.join(dataDir, "auth.json")
}

function getProjectAuthPath(): string {
  return path.join(process.cwd(), ".miniagent", "auth.json")
}

function readAuthFile(filePath: string): Record<string, AuthInfo> | null {
  try {
    if (!fs.existsSync(filePath)) return null
    const raw = fs.readFileSync(filePath, "utf-8")
    const parsed = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return null
    return parsed as Record<string, AuthInfo>
  } catch {
    return null
  }
}

export class AuthManager {
  private globalAuthFile: Record<string, AuthInfo> | null = null
  private projectAuthFile: Record<string, AuthInfo> | null = null
  private initialized = false

  private init(): void {
    if (this.initialized) return
    this.initialized = true

    const globalPath = getAuthFilePath()
    this.globalAuthFile = readAuthFile(globalPath)

    const projectPath = getProjectAuthPath()
    this.projectAuthFile = readAuthFile(projectPath)
  }

  getAuthInfo(provider: ProviderName): { info: AuthInfo; source: AuthSource } {
    this.init()

    if (NO_AUTH_PROVIDERS.has(provider)) {
      return {
        info: provider === "ollama"
          ? { apiKey: "", baseURL: "http://localhost:11434/v1" }
          : { apiKey: "" },
        source: "none",
      }
    }

    const keyEnvVar = PROVIDER_ENV_KEY_MAP[provider]
    const baseUrlEnvVar = PROVIDER_ENV_BASE_URL_MAP[provider]

    if (keyEnvVar) {
      const envKey = process.env[keyEnvVar]
      if (envKey) {
        return {
          info: {
            apiKey: envKey,
            baseURL: baseUrlEnvVar
              ? (process.env[baseUrlEnvVar] ?? undefined)
              : undefined,
          },
          source: "env",
        }
      }
    }

    if (this.projectAuthFile?.[provider]) {
      return { info: this.projectAuthFile[provider], source: "auth_file" }
    }

    if (this.globalAuthFile?.[provider]) {
      return { info: this.globalAuthFile[provider], source: "auth_file" }
    }

    return { info: { apiKey: "" }, source: "none" }
  }

  getApiKey(provider: ProviderName): string {
    return this.getAuthInfo(provider).info.apiKey
  }

  getBaseURL(provider: ProviderName): string | undefined {
    return this.getAuthInfo(provider).info.baseURL
  }
}

let defaultAuthManager: AuthManager | null = null

export function getAuthManager(): AuthManager {
  if (!defaultAuthManager) {
    defaultAuthManager = new AuthManager()
  }
  return defaultAuthManager
}
