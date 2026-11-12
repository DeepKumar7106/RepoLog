export type SummaryProjectInput = {
  projectId: string;
  projectTitle: string;
  commitCount: number;
  commitMessages: string[];
  additions: number | null;
  deletions: number | null;
};

export type SummaryInput = {
  date: string;
  timezone: string;
  totalCommits: number;
  projects: SummaryProjectInput[];
};

export type SummaryProjectHighlight = {
  projectId: string;
  text: string;
};

export type SummaryOutput = {
  headline: string;
  summary: string;
  projectHighlights: SummaryProjectHighlight[];
};

export interface SummaryProvider {
  readonly name: string;
  readonly model: string | null;
  generate(input: SummaryInput): Promise<SummaryOutput>;
}
