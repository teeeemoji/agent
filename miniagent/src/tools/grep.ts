import * as child_process from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"
import type { Tool } from "../tool-registry.js"

const MAX_RESULTS = 100

const DEFAULT_IGNORE_PATTERNS = [
  "node_modules",
  ".git",
  "dist",
  ".next",
  "build",
  "coverage",
  "__pycache__",
  ".venv",
  "venv",
]

function resolvePath(filePath: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath
  }
  return path.resolve(process.cwd(), filePath)
}

function isIgnored(filePath: string, baseDir: string): boolean {
  const relative = path.relative(baseDir, filePath)
  if (relative === "") return false
  const parts = relative.split(path.sep)
  for (const part of parts) {
    if (DEFAULT_IGNORE_PATTERNS.includes(part)) {
      return true
    }
  }
  return false
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".")
  return new RegExp(`^${escaped}$`)
}

function searchInDirectory(
  dir: string,
  baseDir: string,
  regex: RegExp,
  globPattern: string | null,
  caseInsensitive: boolean,
  results: Array<{ file: string; line: number; content: string }>,
  level: number
): void {
  if (isIgnored(dir, baseDir) || level > 20) {
    return
  }

  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (results.length >= MAX_RESULTS) return

    const fullPath = path.join(dir, entry.name)
    if (isIgnored(fullPath, baseDir)) continue

    if (entry.isDirectory()) {
      searchInDirectory(fullPath, baseDir, regex, globPattern, caseInsensitive, results, level + 1)
    } else if (entry.isFile()) {
      const relativePath = path.relative(baseDir, fullPath)
      if (globPattern) {
        const globRegex = globToRegex(globPattern)
        if (!globRegex.test(relativePath) && !globRegex.test(entry.name)) {
          continue
        }
      }
      try {
        const stat = fs.statSync(fullPath)
        if (stat.size > 1024 * 1024) continue
      } catch {
        continue
      }

      try {
        const content = fs.readFileSync(fullPath, "utf-8")
        const lines = content.split("\n")
        for (let i = 0; i < lines.length; i++) {
          if (results.length >= MAX_RESULTS) return
          const testLine = caseInsensitive ? lines[i].toLowerCase() : lines[i]
          const testPattern = caseInsensitive
            ? lines[i].toLowerCase().includes(regex.source.toLowerCase())
            : regex.test(lines[i])

          if (testPattern) {
            results.push({
              file: relativePath.replace(/\\/g, "/"),
              line: i + 1,
              content: lines[i].slice(0, 200),
            })
          }
        }
      } catch {
        continue
      }
    }
  }
}

function tryRipgrep(
  pattern: string,
  dirPath: string,
  globFilter: string | null,
  caseInsensitive: boolean
): string | null {
  try {
    const args = ["--line-number", "--no-heading", "--color", "never", "--max-count", String(MAX_RESULTS)]

    if (caseInsensitive) {
      args.push("--ignore-case")
    }

    if (globFilter) {
      args.push("--glob", globFilter)
    }

    args.push("--", pattern, dirPath)

    const result = child_process.spawnSync("rg", args, {
      encoding: "utf-8",
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    })

    if (result.error) {
      return null
    }

    const output = (result.stdout || "").trim()
    if (!output) {
      return `未找到匹配 "${pattern}" 的内容`
    }

    const lines = output.split("\n")
    const count = Math.min(lines.length, MAX_RESULTS)
    const header = `在 ${dirPath} 中搜索 "${pattern}":\n找到 ${count} 条匹配结果\n\n`
    return header + lines.slice(0, MAX_RESULTS).join("\n")
  } catch {
    return null
  }
}

function builtInGrep(
  pattern: string,
  dirPath: string,
  globFilter: string | null,
  caseInsensitive: boolean
): string {
  let regex: RegExp
  try {
    regex = new RegExp(pattern, caseInsensitive ? "i" : "")
  } catch {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    regex = new RegExp(escaped, caseInsensitive ? "i" : "")
  }

  const results: Array<{ file: string; line: number; content: string }> = []
  searchInDirectory(dirPath, dirPath, regex, globFilter, caseInsensitive, results, 0)

  if (results.length === 0) {
    return `未找到匹配 "${pattern}" 的内容`
  }

  let output = ""
  for (const r of results) {
    output += `${r.file}:${r.line}:${r.content}\n`
  }

  const header = `在 ${dirPath} 中搜索 "${pattern}":\n找到 ${results.length} 条匹配结果\n\n`
  return header + output
}

export const grepTool: Tool = {
  name: "grep",
  description:
    "在文件中搜索文本内容（支持正则表达式）。递归搜索指定目录下的所有文本文件，返回匹配的行及其位置。",
  parameters: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "要搜索的正则表达式模式或纯文本",
      },
      path: {
        type: "string",
        description: "搜索的目标目录（支持相对路径和绝对路径），默认为当前工作目录",
      },
      glob: {
        type: "string",
        description: "文件名过滤模式（如 *.ts, **/*.test.ts），仅搜索匹配的文件",
      },
      case_insensitive: {
        type: "boolean",
        description: "是否忽略大小写，默认 false",
      },
    },
    required: ["pattern"],
  },
  execute: (args: Record<string, unknown>) => {
    const pattern = String(args.pattern ?? "")
    const searchPath = args.path ? String(args.path) : "."
    const globFilter = args.glob ? String(args.glob) : null
    const caseInsensitive = args.case_insensitive === true

    if (!pattern) {
      return "错误: 缺少 pattern 参数"
    }

    const resolved = resolvePath(searchPath)

    try {
      const stat = fs.statSync(resolved)
      if (!stat.isDirectory()) {
        return `错误: 路径 "${resolved}" 不是一个目录`
      }
    } catch {
      return `错误: 目录 "${resolved}" 不存在`
    }

    const rgResult = tryRipgrep(pattern, resolved, globFilter, caseInsensitive)
    if (rgResult !== null) {
      return rgResult
    }

    return builtInGrep(pattern, resolved, globFilter, caseInsensitive)
  },
}
