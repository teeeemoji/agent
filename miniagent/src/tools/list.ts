import * as fs from "node:fs"
import * as path from "node:path"
import type { Tool } from "../tool-registry.js"

const MAX_DEPTH_DEFAULT = 3
const MAX_DEPTH_LIMIT = 10
const MAX_ENTRIES_PER_DIR = 200

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
  ".DS_Store",
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
    if (part.startsWith(".") && !DEFAULT_IGNORE_PATTERNS.includes(part)) {
      continue
    }
  }
  return false
}

interface TreeEntry {
  name: string
  isDir: boolean
  children: TreeEntry[]
}

function buildTree(
  dir: string,
  baseDir: string,
  depth: number,
  maxDepth: number
): TreeEntry[] {
  if (depth > maxDepth) return []
  if (isIgnored(dir, baseDir)) return []

  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }

  const result: TreeEntry[] = []

  for (const entry of entries) {
    if (result.length >= MAX_ENTRIES_PER_DIR) break

    const fullPath = path.join(dir, entry.name)
    if (isIgnored(fullPath, baseDir)) continue

    if (entry.isDirectory()) {
      const children = buildTree(fullPath, baseDir, depth + 1, maxDepth)
      result.push({ name: entry.name, isDir: true, children })
    } else if (entry.isFile()) {
      result.push({ name: entry.name, isDir: false, children: [] })
    }
  }

  result.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return result
}

function renderTree(entries: TreeEntry[], prefix: string, isLast: boolean): string {
  let output = ""
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const last = i === entries.length - 1
    const connector = last ? "└── " : "├── "
    const newPrefix = prefix + (last ? "    " : "│   ")

    output += `${prefix}${connector}${entry.name}${entry.isDir ? "/" : ""}\n`

    if (entry.isDir && entry.children.length > 0) {
      output += renderTree(entry.children, newPrefix, last)
    }
  }
  return output
}

export const listTool: Tool = {
  name: "list",
  description:
    "列出目录内容，以树形结构展示文件和子目录。自动排除 node_modules、.git 等常见忽略目录。",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "要列出的目录路径（支持相对路径和绝对路径），默认为当前工作目录",
      },
      depth: {
        type: "integer",
        description: `树形结构的最大深度，默认 ${MAX_DEPTH_DEFAULT}，最大 ${MAX_DEPTH_LIMIT}`,
      },
    },
    required: [],
  },
  execute: (args: Record<string, unknown>) => {
    const listPath = args.path ? String(args.path) : "."
    const depth = args.depth != null
      ? Math.min(Math.max(Number(args.depth), 1), MAX_DEPTH_LIMIT)
      : MAX_DEPTH_DEFAULT

    const resolved = resolvePath(listPath)

    try {
      const stat = fs.statSync(resolved)
      if (!stat.isDirectory()) {
        return `错误: 路径 "${resolved}" 不是一个目录`
      }
    } catch {
      return `错误: 目录 "${resolved}" 不存在`
    }

    const tree = buildTree(resolved, resolved, 1, depth)

    if (tree.length === 0) {
      return `${resolved}/\n(空目录)`
    }

    let output = `${resolved}/\n`
    output += renderTree(tree, "", true)

    const countDirs = (entries: TreeEntry[]): number => {
      let c = 0
      for (const e of entries) {
        if (e.isDir) c++
        c += countDirs(e.children)
      }
      return c
    }

    const countFiles = (entries: TreeEntry[]): number => {
      let c = 0
      for (const e of entries) {
        if (!e.isDir) c++
        c += countFiles(e.children)
      }
      return c
    }

    output += `\n${countDirs(tree)} 个目录, ${countFiles(tree)} 个文件`

    return output
  },
}
