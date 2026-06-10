import * as fs from "node:fs"
import * as path from "node:path"
import type { Tool } from "../tool-registry.js"

const MAX_RESULTS = 200

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
  let regexStr = ""
  let i = 0
  while (i < pattern.length) {
    if (pattern[i] === "*") {
      if (i + 1 < pattern.length && pattern[i + 1] === "*") {
        regexStr += ".*"
        i += 2
        if (i < pattern.length && pattern[i] === "/") {
          regexStr += "/"
          i++
        }
      } else {
        regexStr += "[^/]*"
        i++
      }
    } else if (pattern[i] === "?") {
      regexStr += "[^/]"
      i++
    } else if (pattern[i] === ".") {
      regexStr += "\\."
      i++
    } else {
      regexStr += pattern[i]
      i++
    }
  }
  return new RegExp(`^${regexStr}$`)
}

function collectFiles(
  dir: string,
  baseDir: string,
  regex: RegExp,
  results: Array<{ path: string; mtime: number }>,
  level: number
): void {
  if (isIgnored(dir, baseDir) || level > 20 || results.length >= MAX_RESULTS) {
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
      collectFiles(fullPath, baseDir, regex, results, level + 1)
    } else if (entry.isFile()) {
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, "/")
      if (regex.test(relativePath)) {
        try {
          const stat = fs.statSync(fullPath)
          results.push({ path: relativePath, mtime: stat.mtimeMs })
        } catch {
          results.push({ path: relativePath, mtime: 0 })
        }
      }
    }
  }
}

export const globTool: Tool = {
  name: "glob",
  description:
    "按文件名模式匹配搜索文件。支持通配符（*、**、?），递归搜索目录树，返回匹配的文件路径列表。",
  parameters: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "文件匹配模式，如 *.ts、src/**\/*.test.ts、**/*.md",
      },
      path: {
        type: "string",
        description: "搜索的目标目录（支持相对路径和绝对路径），默认为当前工作目录",
      },
    },
    required: ["pattern"],
  },
  execute: (args: Record<string, unknown>) => {
    const pattern = String(args.pattern ?? "")
    const searchPath = args.path ? String(args.path) : "."

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

    const regex = globToRegex(pattern)
    const results: Array<{ path: string; mtime: number }> = []
    collectFiles(resolved, resolved, regex, results, 0)

    if (results.length === 0) {
      return `未找到匹配模式 "${pattern}" 的文件`
    }

    results.sort((a, b) => b.mtime - a.mtime)
    const limited = results.slice(0, MAX_RESULTS)

    let output = ""
    for (const r of limited) {
      output += `${r.path}\n`
    }

    const header = `搜索模式 "${pattern}" 在 ${resolved}:\n找到 ${results.length} 个匹配文件${results.length > MAX_RESULTS ? `（仅显示前 ${MAX_RESULTS} 个）` : ""}\n\n`
    return header + output
  },
}
