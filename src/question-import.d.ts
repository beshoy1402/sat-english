export type ImportRow = {
  sourceRow: number;
  exam_program: string;
  topic: string;
  difficulty: string;
  passage: string;
  prompt: string;
  question_type: string;
  choices: string[];
  answer_key: string;
  explanation: string;
  points: number;
  errors: string[];
  duplicate: boolean;
};
export function normalizePrompt(value: unknown): string;
export function parseCsv(source: string): Record<string, any>[];
export function toImportRow(raw: Record<string, any>, sourceRow: number, existing?: Set<string>): ImportRow;
