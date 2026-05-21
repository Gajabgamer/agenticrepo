import { getPrisma } from '@/lib/database/prisma';
import { decryptSecret } from '@/lib/security/secrets';

export type RepositoryTreeNode = {
  name: string;
  path: string;
  type: 'tree' | 'blob';
  extension?: string;
  risk: 'low' | 'medium' | 'high';
  tags: string[];
  children: RepositoryTreeNode[];
};

export type RepositoryHotspot = {
  path: string;
  score: number;
  reasons: string[];
};

export type RepositoryIntelligenceResult = {
  repository: string;
  defaultBranch: string;
  tree: RepositoryTreeNode[];
  modules: Array<{ name: string; files: number; risk: 'low' | 'medium' | 'high'; responsibilities: string[] }>;
  workflows: Array<{ path: string; connectedModules: string[] }>;
  hotspots: RepositoryHotspot[];
  summary: string;
  patterns: string[];
  risks: string[];
  generatedDocs: string;
};

type GitHubTreeItem = {
  path?: string;
  type?: string;
};

const importantExtensions = new Set(['ts', 'tsx', 'js', 'jsx', 'json', 'yml', 'yaml', 'prisma', 'md']);

// made by bob
export async function analyzeConnectedRepository(userId: string): Promise<RepositoryIntelligenceResult> {
  const prisma = getPrisma();
  const [repository, user, incidents, investigations, activityEvents] = await Promise.all([
    prisma.connectedRepository.findUnique({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { githubAccessToken: true } }),
    prisma.incident.findMany({ orderBy: { openedAt: 'desc' }, take: 30 }),
    prisma.investigation.findMany({ orderBy: { startedAt: 'desc' }, take: 20 }),
    prisma.activityEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 80 }),
  ]);

  if (!repository) {
    throw new Error('Connect a repository before running repository intelligence.');
  }

  if (!user?.githubAccessToken) {
    throw new Error('GitHub access token is required for repository intelligence.');
  }

  const repositoryName = `${repository.owner}/${repository.repoName}`;
  const files = await fetchRepositoryTree({
    owner: repository.owner,
    repo: repository.repoName,
    branch: repository.defaultBranch,
    token: decryptSecret(user.githubAccessToken),
  });
  const riskMap = buildRiskMap(incidents, investigations, activityEvents);
  const filteredFiles = files.filter((file) => isUsefulPath(file.path));
  const hotspots = detectHotspots(filteredFiles, riskMap);
  const workflows = filteredFiles
    .filter((file) => file.path.startsWith('.github/workflows/'))
    .map((file) => ({
      path: file.path,
      connectedModules: inferWorkflowModules(file.path, filteredFiles.map((item) => item.path)),
    }));
  const modules = inferModules(filteredFiles.map((file) => file.path), hotspots);
  const tree = buildTree(filteredFiles, riskMap, hotspots);
  const patterns = inferPatterns(filteredFiles.map((file) => file.path));
  const risks = inferRisks(hotspots, workflows, incidents.length);
  const summary = `${repositoryName} contains ${filteredFiles.length} mapped engineering files across ${modules.length} module area(s). ${workflows.length} workflow definition(s) connect CI/CD behavior to repository modules.`;

  return {
    repository: repositoryName,
    defaultBranch: repository.defaultBranch,
    tree,
    modules,
    workflows,
    hotspots,
    summary,
    patterns,
    risks,
    generatedDocs: generateArchitectureDocs(repositoryName, modules, workflows, hotspots, patterns, risks),
  };
}

async function fetchRepositoryTree(input: { owner: string; repo: string; branch: string; token: string }) {
  const response = await fetch(
    `https://api.github.com/repos/${input.owner}/${input.repo}/git/trees/${encodeURIComponent(input.branch)}?recursive=1`,
    {
      headers: {
        Authorization: `Bearer ${input.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    throw new Error(`GitHub tree fetch failed: ${response.status}`);
  }

  const data = await response.json() as { tree?: GitHubTreeItem[] };
  return (data.tree || [])
    .filter((item) => item.type === 'blob' && item.path)
    .map((item) => ({ path: item.path as string }));
}

function isUsefulPath(path: string): boolean {
  if (path.includes('node_modules/') || path.includes('.next/') || path.includes('dist/') || path.includes('build/')) {
    return false;
  }

  const extension = path.split('.').pop()?.toLowerCase();
  return path.startsWith('.github/workflows/') || Boolean(extension && importantExtensions.has(extension));
}

function buildRiskMap(
  incidents: Array<{ affectedFiles: string | null; repository: string }>,
  investigations: Array<{ affectedFiles: string | null; suspiciousCommits: string | null }>,
  activityEvents: Array<{ eventType: string; details: string | null }>
): Map<string, number> {
  const risk = new Map<string, number>();

  for (const incident of incidents) {
    for (const file of parseStringArray(incident.affectedFiles)) {
      risk.set(file, (risk.get(file) || 0) + 35);
    }
  }

  for (const investigation of investigations) {
    for (const file of parseStringArray(investigation.affectedFiles)) {
      risk.set(file, (risk.get(file) || 0) + 30);
    }
  }

  for (const event of activityEvents) {
    const details = safeJson(event.details);
    const detailsRecord = details && !Array.isArray(details) ? details : {};
    const detectedFiles = detailsRecord.detectedFiles;
    const updatedFiles = detailsRecord.updatedFiles;
    const files = Array.isArray(detectedFiles) ? detectedFiles : Array.isArray(updatedFiles) ? updatedFiles : [];
    for (const file of files.filter((item): item is string => typeof item === 'string')) {
      risk.set(file, (risk.get(file) || 0) + (event.eventType === 'successful_fix' ? 12 : 20));
    }
  }

  return risk;
}

function detectHotspots(files: Array<{ path: string }>, riskMap: Map<string, number>): RepositoryHotspot[] {
  return files
    .map((file) => {
      const workflowRisk = file.path.startsWith('.github/workflows/') ? 20 : 0;
      const testRisk = file.path.includes('test') || file.path.includes('spec') ? 10 : 0;
      const configRisk = file.path.includes('package.json') || file.path.includes('prisma/') ? 8 : 0;
      const score = Math.min(100, (riskMap.get(file.path) || 0) + workflowRisk + testRisk + configRisk);
      const reasons = [
        ...(riskMap.has(file.path) ? ['linked to incident or investigation evidence'] : []),
        ...(workflowRisk ? ['workflow-critical file'] : []),
        ...(testRisk ? ['test or regression surface'] : []),
        ...(configRisk ? ['configuration/dependency surface'] : []),
      ];

      return { path: file.path, score, reasons };
    })
    .filter((hotspot) => hotspot.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

function inferModules(paths: string[], hotspots: RepositoryHotspot[]) {
  const moduleMap = new Map<string, string[]>();
  const hotspotPaths = new Set(hotspots.filter((hotspot) => hotspot.score >= 40).map((hotspot) => hotspot.path));

  for (const path of paths) {
    const parts = path.split('/');
    const moduleName = parts[0] === 'src' && parts[1] ? `src/${parts[1]}` : parts[0];
    moduleMap.set(moduleName, [...(moduleMap.get(moduleName) || []), path]);
  }

  return Array.from(moduleMap.entries()).map(([name, files]) => ({
    name,
    files: files.length,
    risk: files.some((file) => hotspotPaths.has(file)) ? 'high' as const : files.length > 20 ? 'medium' as const : 'low' as const,
    responsibilities: inferResponsibilities(name, files),
  })).sort((a, b) => b.files - a.files).slice(0, 10);
}

function inferResponsibilities(name: string, files: string[]): string[] {
  const joined = `${name} ${files.join(' ')}`.toLowerCase();
  const responsibilities = [];

  if (joined.includes('api') || joined.includes('route')) responsibilities.push('HTTP/API boundary');
  if (joined.includes('component') || joined.includes('app/')) responsibilities.push('frontend application surface');
  if (joined.includes('github')) responsibilities.push('GitHub workflow integration');
  if (joined.includes('workflow') || joined.includes('.github')) responsibilities.push('CI/CD orchestration');
  if (joined.includes('prisma') || joined.includes('database')) responsibilities.push('data persistence');
  if (joined.includes('test') || joined.includes('spec')) responsibilities.push('quality and regression coverage');

  return responsibilities.length > 0 ? responsibilities : ['repository module'];
}

function inferWorkflowModules(workflowPath: string, paths: string[]): string[] {
  const lowerWorkflow = workflowPath.toLowerCase();
  const candidates = paths.filter((path) => {
    const lowerPath = path.toLowerCase();
    return lowerWorkflow.includes('test') && lowerPath.includes('test') ||
      lowerWorkflow.includes('build') && (lowerPath.includes('package.json') || lowerPath.includes('next.config')) ||
      lowerWorkflow.includes('deploy') && (lowerPath.includes('vercel') || lowerPath.includes('next.config'));
  });

  return Array.from(new Set(candidates.map((path) => path.split('/').slice(0, 2).join('/')))).slice(0, 6);
}

function buildTree(files: Array<{ path: string }>, riskMap: Map<string, number>, hotspots: RepositoryHotspot[]): RepositoryTreeNode[] {
  const root: RepositoryTreeNode[] = [];
  const hotspotMap = new Map(hotspots.map((hotspot) => [hotspot.path, hotspot.score]));

  for (const file of files) {
    const parts = file.path.split('/');
    let level = root;
    let currentPath = '';

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = index === parts.length - 1;
      let node = level.find((item) => item.name === part);

      if (!node) {
        const score = hotspotMap.get(currentPath) || riskMap.get(currentPath) || 0;
        node = {
          name: part,
          path: currentPath,
          type: isFile ? 'blob' : 'tree',
          extension: isFile ? part.split('.').pop() : undefined,
          risk: score >= 50 ? 'high' : score >= 20 ? 'medium' : 'low',
          tags: buildTags(currentPath, score),
          children: [],
        };
        level.push(node);
      }

      level = node.children;
    });
  }

  return root.sort(sortTreeNodes);
}

function buildTags(path: string, score: number): string[] {
  return [
    ...(score >= 20 ? ['hotspot'] : []),
    ...(path.startsWith('.github/workflows/') ? ['workflow'] : []),
    ...(path.includes('test') || path.includes('spec') ? ['test'] : []),
    ...(path.includes('package.json') || path.includes('prisma') ? ['dependency'] : []),
  ];
}

function sortTreeNodes(a: RepositoryTreeNode, b: RepositoryTreeNode): number {
  if (a.type !== b.type) return a.type === 'tree' ? -1 : 1;
  return a.name.localeCompare(b.name);
}

function inferPatterns(paths: string[]): string[] {
  return [
    ...(paths.some((path) => path.startsWith('src/app/')) ? ['Next.js App Router application structure'] : []),
    ...(paths.some((path) => path.startsWith('.github/workflows/')) ? ['GitHub Actions-backed workflow automation'] : []),
    ...(paths.some((path) => path.includes('prisma')) ? ['Prisma-backed persistence layer'] : []),
    ...(paths.some((path) => path.includes('api/')) ? ['API route-driven backend integration'] : []),
  ];
}

function inferRisks(hotspots: RepositoryHotspot[], workflows: Array<{ path: string }>, incidentCount: number): string[] {
  return [
    ...(hotspots.length > 0 ? [`${hotspots.length} engineering hotspot(s) linked to workflows, incidents, or investigation evidence`] : []),
    ...(workflows.length === 0 ? ['No GitHub workflow definitions found in repository tree'] : []),
    ...(incidentCount > 0 ? [`${incidentCount} incident(s) influence architecture risk scoring`] : []),
  ];
}

function generateArchitectureDocs(repository: string, modules: RepositoryIntelligenceResult['modules'], workflows: RepositoryIntelligenceResult['workflows'], hotspots: RepositoryHotspot[], patterns: string[], risks: string[]): string {
  return [
    `# ${repository} Architecture Intelligence`,
    '',
    '## Architecture Summary',
    `AgenticRepo mapped ${modules.length} module area(s), ${workflows.length} workflow definition(s), and ${hotspots.length} operational hotspot(s).`,
    '',
    '## Module Responsibilities',
    ...modules.map((module) => `- ${module.name}: ${module.responsibilities.join(', ')} (${module.files} files, ${module.risk} risk)`),
    '',
    '## Workflow Relationships',
    ...(workflows.length ? workflows.map((workflow) => `- ${workflow.path}: ${workflow.connectedModules.join(', ') || 'repository-wide workflow'}`) : ['- No workflow files detected.']),
    '',
    '## Operational Risks',
    ...(risks.length ? risks.map((risk) => `- ${risk}`) : ['- No major architecture risks detected from current evidence.']),
    '',
    '## Engineering Patterns',
    ...(patterns.length ? patterns.map((pattern) => `- ${pattern}`) : ['- No dominant pattern detected yet.']),
  ].join('\n');
}

function parseStringArray(value: string | null): string[] {
  if (!value) return [];
  const parsed = safeJson(value);
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
}

function safeJson(value: string | null): Record<string, unknown> | unknown[] | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown> | unknown[];
  } catch {
    return null;
  }
}

// Made with Bob
// made by bob
