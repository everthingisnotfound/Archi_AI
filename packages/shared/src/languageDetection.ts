const extensionLanguageMap: Record<string, string> = {
  ".c": "c",
  ".cc": "cpp",
  ".cpp": "cpp",
  ".cs": "csharp",
  ".css": "css",
  ".go": "go",
  ".h": "c",
  ".hpp": "cpp",
  ".html": "html",
  ".java": "java",
  ".js": "javascript",
  ".jsx": "javascript",
  ".json": "json",
  ".kt": "kotlin",
  ".md": "markdown",
  ".php": "php",
  ".py": "python",
  ".rb": "ruby",
  ".rs": "rust",
  ".scss": "scss",
  ".sh": "shell",
  ".sql": "sql",
  ".swift": "swift",
  ".toml": "toml",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".vue": "vue",
  ".xml": "xml",
  ".yaml": "yaml",
  ".yml": "yaml",
};

const technologyManifests: Array<{ fileName: string; technology: string }> = [
  { fileName: "package.json", technology: "nodejs" },
  { fileName: "pnpm-lock.yaml", technology: "pnpm" },
  { fileName: "yarn.lock", technology: "yarn" },
  { fileName: "package-lock.json", technology: "npm" },
  { fileName: "pyproject.toml", technology: "python" },
  { fileName: "requirements.txt", technology: "python" },
  { fileName: "Pipfile", technology: "python" },
  { fileName: "go.mod", technology: "go" },
  { fileName: "Cargo.toml", technology: "rust" },
  { fileName: "pom.xml", technology: "java-maven" },
  { fileName: "build.gradle", technology: "java-gradle" },
  { fileName: "Gemfile", technology: "ruby" },
  { fileName: "composer.json", technology: "php" },
  { fileName: "Dockerfile", technology: "docker" },
  { fileName: "docker-compose.yml", technology: "docker-compose" },
  { fileName: "docker-compose.yaml", technology: "docker-compose" },
  { fileName: "prisma/schema.prisma", technology: "prisma" },
  { fileName: "tsconfig.json", technology: "typescript" },
  { fileName: "vite.config.ts", technology: "vite" },
  { fileName: "next.config.js", technology: "nextjs" },
  { fileName: "next.config.ts", technology: "nextjs" },
  { fileName: "_archaeologist/site-profile.json", technology: "deployed-website" },
];

export const repositoryScanExclusions = [
  ".git",
  "node_modules",
  "__pycache__",
  ".venv",
  "venv",
  "dist",
  "build",
  "target",
  ".next",
  ".nuxt",
  "coverage",
  ".turbo",
] as const;

export function detectLanguageFromPath(relativePath: string): string | undefined {
  const lowerPath = relativePath.toLowerCase();
  const extension = pathExtension(lowerPath);
  return extension ? extensionLanguageMap[extension] : undefined;
}

export function detectTechnologiesFromPaths(relativePaths: Iterable<string>): string[] {
  const normalizedPaths = new Set(
    Array.from(relativePaths, (relativePath) => relativePath.replaceAll("\\", "/").toLowerCase()),
  );
  const technologies = new Set<string>();

  for (const manifest of technologyManifests) {
    if (normalizedPaths.has(manifest.fileName.toLowerCase())) {
      technologies.add(manifest.technology);
    }
  }

  return [...technologies].sort();
}

export function shouldExcludeRepositoryPath(relativePath: string): boolean {
  const normalized = relativePath.replaceAll("\\", "/");
  const segments = normalized.split("/").filter(Boolean);

  return segments.some((segment) =>
    repositoryScanExclusions.includes(segment as (typeof repositoryScanExclusions)[number]),
  );
}

function pathExtension(filePath: string): string | undefined {
  const fileName = filePath.split("/").at(-1);
  if (!fileName || !fileName.includes(".")) {
    return undefined;
  }

  const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  return extension.length > 1 ? extension : undefined;
}
