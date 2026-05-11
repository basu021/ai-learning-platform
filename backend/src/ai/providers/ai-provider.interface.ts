export interface GenerateTaskRequest {
  subject: string;
  topic: string;
  subtopic: string;
  difficulty: string;
  count: number;
  previousTasks?: string[];
  weakAreas?: string[];
  feedbackHistory?: string[];
  taskType?: string;
}

export interface GeneratedTask {
  title: string;
  description: string;
  difficulty: string;
  taskType: string;
  estimatedMins: number;
  hints: string[];
  commands: string[];
  tags: string[];
}

export interface AnalyzeFeedbackRequest {
  task: { title: string; description: string; subtopic: string };
  feedback: {
    whatWasDone: string;
    problemsFaced: string;
    commandsUsed: string;
    confidenceLevel: number;
    needsImprovement: string;
  };
  learningProgress: {
    mastery: number;
    tasksCompleted: number;
    avgConfidence: number;
    weakAreas: string[];
  };
}

export interface FeedbackAnalysis {
  strengths: string[];
  weaknesses: string[];
  recommendedTopics: string[];
  difficultyAdjustment: string;
  nextTaskSuggestions: string[];
}

export interface AIProvider {
  name: string;
  generateTasks(request: GenerateTaskRequest): Promise<GeneratedTask[]>;
  analyzeFeedback(request: AnalyzeFeedbackRequest): Promise<FeedbackAnalysis>;
}
