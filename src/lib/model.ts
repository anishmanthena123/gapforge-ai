import { z } from "zod";
export const fields = [
  "Automatic detection",
  "Artificial Intelligence",
  "Machine Learning",
  "Robotics",
  "Computer Science",
  "Physics",
  "Engineering",
  "Economics",
  "Biology",
  "Psychology",
  "Interdisciplinary / Other",
] as const;
export const InputSchema = z
  .object({
    question: z.string().trim().min(15).max(12000),
    field: z.enum(fields).default("Automatic detection"),
    fromYear: z.number().int().min(1800).max(2100),
    toYear: z.number().int().min(1800).max(2100),
    depth: z.enum(["quick", "balanced", "deep"]).default("balanced"),
    maxPapers: z.number().int().min(5).max(100).default(30),
    mode: z.enum(["research", "challenge"]).default("research"),
    focusPaperIds: z.array(z.string().max(100)).max(20).optional(),
  })
  .refine((v) => v.fromYear <= v.toYear, {
    message: "Start year must precede end year.",
  });
export type ResearchInput = z.infer<typeof InputSchema>;
export const PaperSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  authors: z.array(z.string()),
  year: z.number().int().nullable(),
  venue: z.string().nullable(),
  abstract: z.string().nullable(),
  doi: z.string().nullable(),
  openalexId: z.string().nullable(),
  semanticId: z.string().nullable(),
  url: z
    .string()
    .url()
    .refine((u) => safeUrl(u) !== null)
    .nullable(),
  openAccessUrl: z
    .string()
    .url()
    .refine((u) => safeUrl(u) !== null)
    .nullable(),
  citations: z.number().nonnegative().nullable(),
  providers: z.array(z.enum(["OpenAlex", "Semantic Scholar"])).min(1),
  topics: z.array(z.string()),
  references: z.array(z.string()),
  retrievedAt: z.string(),
  relevance: z.number().default(0),
});
export type Paper = z.infer<typeof PaperSchema>;
export const ClaimSchema = z.object({
  text: z.string(),
  paperIds: z.array(z.string()).min(1),
  evidence: z.string(),
  limitation: z.string(),
});
export const AssessmentSchema = z.object({
  verdict: z.enum([
    "Strongly overlaps known research",
    "Partially explored",
    "Plausibly underexplored",
    "Insufficient evidence to assess",
  ]),
  summary: z.string(),
  comparisons: z.array(
    z.object({
      paperId: z.string(),
      classification: z.enum([
        "Direct overlap",
        "Significant partial overlap",
        "Related background work",
        "Insufficient information",
      ]),
      question: z.string(),
      method: z.string(),
      finding: z.string(),
      overlap: z.string(),
      difference: z.string(),
      evidence: z.string(),
      limitation: z.string(),
    }),
  ),
  claims: z.array(ClaimSchema),
  gaps: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      explanation: z.string(),
      supportingPaperIds: z.array(z.string()).min(1),
      challengingPaperIds: z.array(z.string()),
      evidence: z.string(),
      limitation: z.string(),
      suggestedSearches: z.array(z.string()),
      experiment: z.string(),
    }),
  ),
  revisions: z.array(
    z.object({
      question: z.string(),
      difference: z.string(),
      paperIds: z.array(z.string()).min(1),
      experiment: z.string(),
      risk: z.string(),
      difficulty: z.string(),
      resources: z.string(),
    }),
  ),
});
export type Assessment = z.infer<typeof AssessmentSchema>;
export const ConceptsSchema = z.object({
  field: z.string(),
  concepts: z.array(z.string()),
  terminology: z.array(z.string()),
  methods: z.array(z.string()),
  claims: z.array(z.string()),
  comparisons: z.array(z.string()),
  queries: z.array(z.string()).min(2).max(8),
});
export type Concepts = z.infer<typeof ConceptsSchema>;
export const ExperimentSchema = z.object({
  title: z.string(),
  question: z.string(),
  hypothesis: z.string(),
  independentVariables: z.array(z.string()),
  dependentVariables: z.array(z.string()),
  controls: z.array(z.string()),
  baselines: z.array(z.string()),
  methodology: z.string(),
  equipment: z.array(z.string()),
  datasets: z.array(z.string()),
  frameworks: z.array(z.string()),
  metrics: z.array(z.string()),
  statistics: z.string(),
  challenges: z.array(z.string()),
  limitations: z.array(z.string()),
  resources: z.string(),
  timeline: z.array(
    z.object({ month: z.number().int().min(1).max(6), task: z.string() }),
  ),
  paperIds: z.array(z.string()).min(1),
});
export type Experiment = z.infer<typeof ExperimentSchema>;
export type EdgeType =
  | "citation"
  | "shared-reference"
  | "co-citation"
  | "similarity"
  | "idea";
export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  verified: boolean;
  explanation: string;
  evidence: string[];
  weight: number;
};
export const ProjectSchema = z.object({
  id: z.uuid(),
  question: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  input: InputSchema,
  papers: z.array(PaperSchema),
  queries: z.array(z.string()),
  concepts: ConceptsSchema,
  warnings: z.array(z.string()),
  assessment: AssessmentSchema.nullable(),
  challenge: AssessmentSchema.nullable(),
  challengeQueries: z.array(z.string()),
  challengePaperIds: z.array(z.string()),
  experiment: ExperimentSchema.nullable(),
  notes: z.string(),
  bookmarks: z.array(z.string()),
  savedGaps: z.array(z.string()),
  positions: z.record(z.string(), z.object({ x: z.number(), y: z.number() })),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      text: z.string(),
      paperIds: z.array(z.string()),
    }),
  ),
  searchHistory: z.array(
    z.object({
      at: z.string(),
      mode: z.string(),
      queries: z.array(z.string()),
      count: z.number(),
    }),
  ),
});
export type Project = z.infer<typeof ProjectSchema>;
export type AnalysisEvent =
  | { type: "progress"; stage: string; detail?: string }
  | { type: "result"; data: AnalysisResult }
  | { type: "error"; error: string };
export type AnalysisResult = {
  papers: Paper[];
  queries: string[];
  concepts: Concepts;
  warnings: string[];
  assessment: Assessment | null;
};
export const stages = [
  "Understanding research question",
  "Searching literature",
  "Retrieving research papers",
  "Deduplicating studies",
  "Ranking related papers",
  "Analyzing evidence",
  "Evaluating novelty",
  "Generating research report",
];
export function makeProject(
  input: ResearchInput,
  result: AnalysisResult,
): Project {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    question: input.question,
    createdAt: now,
    updatedAt: now,
    input,
    papers: result.papers,
    queries: result.queries,
    concepts: result.concepts,
    warnings: result.warnings,
    assessment: result.assessment,
    challenge: null,
    challengeQueries: [],
    challengePaperIds: [],
    experiment: null,
    notes: "",
    bookmarks: [],
    savedGaps: [],
    positions: {},
    messages: [],
    searchHistory: [
      {
        at: now,
        mode: input.mode,
        queries: result.queries,
        count: result.papers.length,
      },
    ],
  };
}
export function safeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
