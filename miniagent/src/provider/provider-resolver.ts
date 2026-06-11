import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import type { ProviderModelId, ProviderName } from "./types.js"

export interface ProviderConfig {
  provider: ProviderName
  model?: string
}

export interface ProviderResolutionOptions {
  taskOverride?: string
  agentDefault?: ProviderModelId
  configDir?: string
}

interface ProviderConfigFile {
  provider: string
  model?: string
}

const PROVIDER_MODEL_ENV_MAP: Record<string, string> = {
  openai: "OPENAI_MODEL",
  anthropic: "ANTHROPIC_MODEL",
  deepseek: "DEEPSEEK_MODEL",
  groq: "GROQ_MODEL",
  openrouter: "OPENROUTER_MODEL",
}

function getSystemDefault(): ProviderModelId {
  const provider = "openai"
  const envVar = PROVIDER_MODEL_ENV_MAP[provider]
  const modelId = (envVar ? process.env[envVar] : undefined) ?? "gpt-4o"
  return { provider, modelId }
}

function getGlobalConfigPath(): string {
  const dataDir = process.env.OPENAUTH_DATA_DIR
    ?? path.join(os.homedir(), ".miniagent")
  return path.join(dataDir, "config.json")
}

function readConfigFile(filePath: string): ProviderConfigFile | null {
  try {
    if (!fs.existsSync(filePath)) return null
    const raw = fs.readFileSync(filePath, "utf-8")
    const parsed = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return null
    if (typeof parsed.provider !== "string") return null
    return parsed as ProviderConfigFile
  } catch {
    return null
  }
}

function parseProviderModelId(raw: string): ProviderModelId {
  const slashIndex = raw.indexOf("/")
  if (slashIndex < 0) {
    return { provider: raw, modelId: raw }
  }
  return {
    provider: raw.slice(0, slashIndex),
    modelId: raw.slice(slashIndex + 1),
  }
}

export class ProviderResolver {
  resolve(options?: ProviderResolutionOptions): ProviderModelId {
    if (options?.taskOverride) {
      return parseProviderModelId(options.taskOverride)
    }

    if (options?.agentDefault) {
      return options.agentDefault
    }

    const projectConfigPath = path.join(
      options?.configDir ?? path.join(process.cwd(), ".miniagent"),
      "config.json"
    )
    const projectConfig = readConfigFile(projectConfigPath)
    if (projectConfig) {
      const modelId = projectConfig.model ?? projectConfig.provider
      return { provider: projectConfig.provider, modelId }
    }

    const globalConfig = readConfigFile(getGlobalConfigPath())
    if (globalConfig) {
      const modelId = globalConfig.model ?? globalConfig.provider
      return { provider: globalConfig.provider, modelId }
    }

    return getSystemDefault()
  }

  resolveModelId(options?: ProviderResolutionOptions): string {
    return this.resolve(options).modelId
  }

  resolveProvider(options?: ProviderResolutionOptions): ProviderName {
    return this.resolve(options).provider
  }
}

let defaultResolver: ProviderResolver | null = null

export function getProviderResolver(): ProviderResolver {
  if (!defaultResolver) {
    defaultResolver = new ProviderResolver()
  }
  return defaultResolver
}
