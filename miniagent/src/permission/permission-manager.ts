import micromatch from "micromatch"
import * as fs from "node:fs"
import * as path from "node:path"

export type Permission = "allow" | "deny" | "ask"

export interface PermissionRules {
  [globPattern: string]: Permission
}

export interface PermissionConfig {
  [toolName: string]: PermissionRules
}

const DEFAULT_CONFIG: PermissionConfig = {
  read: { "**": "allow" },
  write: { "**": "ask" },
  edit: { "**": "ask" },
  bash: { "**": "ask" },
  grep: { "**": "allow" },
  glob: { "**": "allow" },
  list: { "**": "allow" },
  echo: { "**": "allow" },
}

export class PermissionManager {
  private config: PermissionConfig

  constructor(config?: PermissionConfig) {
    this.config = config ?? structuredClone(DEFAULT_CONFIG)
  }

  static fromFile(filePath: string): PermissionManager {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8")
      const config = JSON.parse(raw) as PermissionConfig
      return new PermissionManager(config)
    }
    return new PermissionManager()
  }

  checkPermission(toolName: string, input: string): Permission {
    const rules = this.config[toolName]
    if (!rules) {
      return "ask"
    }

    let allowMatched = false
    let askMatched = false

    for (const [pattern, action] of Object.entries(rules)) {
      if (micromatch.isMatch(input, pattern, { dot: true })) {
        if (action === "deny") {
          return "deny"
        }
        if (action === "allow") {
          allowMatched = true
        }
        if (action === "ask") {
          askMatched = true
        }
      }
    }

    if (allowMatched) return "allow"
    if (askMatched) return "ask"

    return "ask"
  }

  static extractInput(toolName: string, args: Record<string, unknown>): string {
    switch (toolName) {
      case "read":
      case "write":
      case "edit":
        return String(args.file_path ?? "")
      case "bash":
        return String(args.command ?? "")
      case "grep":
        return String(args.path ?? args.pattern ?? "")
      case "glob":
        return String(args.path ?? args.pattern ?? "")
      case "list":
        return String(args.path ?? ".")
      default:
        return String(args.message ?? JSON.stringify(args))
    }
  }

  static getDefaultConfig(): PermissionConfig {
    return structuredClone(DEFAULT_CONFIG)
  }

  static createDefaultConfigFile(dirPath: string): void {
    fs.mkdirSync(dirPath, { recursive: true })
    const filePath = path.join(dirPath, "permissions.json")
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(
        filePath,
        JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n",
        "utf-8"
      )
    }
  }
}
