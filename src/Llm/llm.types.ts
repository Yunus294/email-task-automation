export interface EmailForAnalysis {
  from: string;
  subject: string;
  body: string;
}

export interface EmailAnalysis {
  isActionable: boolean;
  title: string | null;
  description: string | null;
  dueDate: string | null;
  assigneeEmail: string | null;
  confidence: number;
}
