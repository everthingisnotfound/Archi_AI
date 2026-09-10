export const repositoryLimitDefaults = {
  maxRepositoryBytes: 268_435_456,
  maxRepositoryFiles: 50_000,
  maxUploadBytes: 104_857_600,
  maxSingleFileBytes: 10_485_760,
  maxArchiveDepth: 12,
  maxPathSegments: 80,
  maxPathLength: 512,
} as const;

export const passwordPolicy = {
  minLength: 12,
  maxLength: 256,
} as const;

// Live-site assessment is intentionally bounded. It is a passive inventory of
// pages a normal unauthenticated browser can reach, not an unbounded crawler or
// an active vulnerability scanner.
export const websiteCrawlDefaults = {
  maxAssets: 24,
  maxDepth: 3,
  maxPages: 40,
  requestDelayMs: 250,
} as const;
