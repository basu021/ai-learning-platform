import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AIProvider,
  GenerateTaskRequest,
  GeneratedTask,
  AnalyzeFeedbackRequest,
  FeedbackAnalysis,
} from './ai-provider.interface';

@Injectable()
export class OpenAIProvider implements AIProvider {
  name = 'openai';
  private apiKey: string;
  private model: string;
  private logger = new Logger('OpenAIProvider');

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY', '');
    this.model = this.configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
  }

  async generateTasks(request: GenerateTaskRequest): Promise<GeneratedTask[]> {
    const prompt = this.buildTaskPrompt(request);

    if (!this.apiKey) {
      return this.generateFallbackTasks(request);
    }

    try {
      const response = await fetch(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              {
                role: 'system',
                content:
                  'You are a technical training task generator. Generate practical, hands-on tasks for system administrators, DBAs, and DevOps engineers. Tasks must be practical, command-focused, troubleshooting-oriented, and production-like. Never generate generic theory-only questions. Respond with valid JSON only.',
              },
              { role: 'user', content: prompt },
            ],
            temperature: 0.8,
            response_format: { type: 'json_object' },
          }),
        },
      );

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      const content = data.choices[0].message.content;
      const parsed = JSON.parse(content) as { tasks: GeneratedTask[] };
      return parsed.tasks;
    } catch (error) {
      this.logger.error('OpenAI API error, using fallback', error);
      return this.generateFallbackTasks(request);
    }
  }

  async analyzeFeedback(
    request: AnalyzeFeedbackRequest,
  ): Promise<FeedbackAnalysis> {
    if (!this.apiKey) {
      return this.generateFallbackAnalysis(request);
    }

    try {
      const prompt = `Analyze this learning feedback and provide recommendations:
Task: ${request.task.title} (${request.task.subtopic})
What was done: ${request.feedback.whatWasDone}
Problems faced: ${request.feedback.problemsFaced}
Commands used: ${request.feedback.commandsUsed}
Confidence: ${request.feedback.confidenceLevel}/5
Needs improvement: ${request.feedback.needsImprovement}
Current mastery: ${request.learningProgress.mastery}%
Tasks completed: ${request.learningProgress.tasksCompleted}
Weak areas: ${request.learningProgress.weakAreas.join(', ')}

Respond with JSON: { "strengths": [], "weaknesses": [], "recommendedTopics": [], "difficultyAdjustment": "maintain|increase|decrease", "nextTaskSuggestions": [] }`;

      const response = await fetch(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              {
                role: 'system',
                content:
                  'You are a technical training mentor. Respond with valid JSON only.',
              },
              { role: 'user', content: prompt },
            ],
            temperature: 0.7,
            response_format: { type: 'json_object' },
          }),
        },
      );

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      return JSON.parse(data.choices[0].message.content) as FeedbackAnalysis;
    } catch (error) {
      this.logger.error('OpenAI feedback analysis error', error);
      return this.generateFallbackAnalysis(request);
    }
  }

  private buildTaskPrompt(request: GenerateTaskRequest): string {
    let prompt = `Generate ${request.count} practical ${request.difficulty}-level tasks for:
Subject: ${request.subject}
Topic: ${request.topic}
Subtopic: ${request.subtopic}
Task type: ${request.taskType || 'mixed'}

Requirements:
- Tasks must be PRACTICAL and hands-on
- Include real-world troubleshooting scenarios
- Focus on command-line operations
- Include production-like scenarios
- Progressive difficulty within the set`;

    if (request.weakAreas?.length) {
      prompt += `\n\nFocus on these weak areas: ${request.weakAreas.join(', ')}`;
    }
    if (request.previousTasks?.length) {
      prompt += `\n\nAvoid repeating: ${request.previousTasks.join(', ')}`;
    }
    if (request.feedbackHistory?.length) {
      prompt += `\n\nPrevious feedback: ${request.feedbackHistory.join('; ')}`;
    }

    prompt += `\n\nRespond with JSON: { "tasks": [{ "title": "", "description": "", "difficulty": "", "taskType": "", "estimatedMins": 0, "hints": [], "commands": [], "tags": [] }] }`;
    return prompt;
  }

  private generateFallbackTasks(request: GenerateTaskRequest): GeneratedTask[] {
    const templates = this.getTaskTemplates(
      request.subtopic,
      request.difficulty,
    );
    return templates.slice(0, request.count);
  }

  private generateFallbackAnalysis(
    request: AnalyzeFeedbackRequest,
  ): FeedbackAnalysis {
    const confidence = request.feedback.confidenceLevel;
    return {
      strengths:
        confidence >= 4
          ? ['Good understanding of core concepts']
          : ['Attempting tasks consistently'],
      weaknesses:
        confidence <= 2
          ? [
              'Needs more practice with fundamentals',
              request.feedback.needsImprovement,
            ]
          : ['Room for optimization'],
      recommendedTopics: [request.task.subtopic],
      difficultyAdjustment:
        confidence <= 2
          ? 'decrease'
          : confidence >= 4
            ? 'increase'
            : 'maintain',
      nextTaskSuggestions: [
        `Practice more ${request.task.subtopic} scenarios`,
        'Focus on troubleshooting exercises',
        'Try production-like configurations',
      ],
    };
  }

  private getTaskTemplates(
    subtopic: string,
    difficulty: string,
  ): GeneratedTask[] {
    const lower = subtopic.toLowerCase();
    if (lower.includes('ssh')) {
      return [
        {
          title: 'Configure passwordless SSH between two servers',
          description:
            'Set up SSH key-based authentication between a client and server machine. Generate an SSH key pair, copy the public key to the remote server, and verify passwordless login works correctly.',
          difficulty,
          taskType: 'practice',
          estimatedMins: 15,
          hints: [
            'Use ssh-keygen to generate keys',
            'Use ssh-copy-id for key distribution',
          ],
          commands: ['ssh-keygen', 'ssh-copy-id', 'ssh', 'chmod'],
          tags: ['ssh', 'authentication', 'security'],
        },
        {
          title: 'Fix "Permission denied (publickey)" SSH error',
          description:
            'A remote server is rejecting SSH key authentication with "Permission denied (publickey)". Debug the issue by checking key permissions, authorized_keys file, and SSH daemon configuration.',
          difficulty,
          taskType: 'troubleshooting',
          estimatedMins: 20,
          hints: [
            'Check ~/.ssh directory permissions (700)',
            'Check authorized_keys permissions (600)',
          ],
          commands: [
            'ssh -vvv',
            'ls -la ~/.ssh',
            'chmod',
            'cat /var/log/auth.log',
          ],
          tags: ['ssh', 'troubleshooting', 'permissions'],
        },
        {
          title: 'Harden SSH configuration for production',
          description:
            'Configure SSH daemon for production security: disable root login, disable password authentication, change default port, set up fail2ban, configure SSH key-only access.',
          difficulty,
          taskType: 'scenario',
          estimatedMins: 30,
          hints: [
            'Edit /etc/ssh/sshd_config',
            'Always test before disconnecting',
          ],
          commands: ['sshd -t', 'systemctl restart sshd', 'fail2ban-client'],
          tags: ['ssh', 'security', 'hardening'],
        },
      ];
    }

    return [
      {
        title: `Practice ${subtopic} - Configuration Exercise`,
        description: `Set up and configure ${subtopic}. Follow best practices for a production environment. Document all steps and verify the configuration works correctly.`,
        difficulty,
        taskType: 'practice',
        estimatedMins: 20,
        hints: [
          'Read the official documentation',
          'Test in a safe environment first',
        ],
        commands: [],
        tags: [subtopic.toLowerCase()],
      },
      {
        title: `Troubleshoot ${subtopic} - Common Issues`,
        description: `Diagnose and fix common issues related to ${subtopic}. Identify the root cause, apply the fix, and verify the resolution.`,
        difficulty,
        taskType: 'troubleshooting',
        estimatedMins: 25,
        hints: ['Check logs first', 'Verify configuration syntax'],
        commands: [],
        tags: [subtopic.toLowerCase(), 'troubleshooting'],
      },
      {
        title: `${subtopic} - Production Scenario`,
        description: `Handle a production scenario involving ${subtopic}. Plan, execute, and verify your changes in a production-like environment.`,
        difficulty,
        taskType: 'scenario',
        estimatedMins: 30,
        hints: ['Always have a rollback plan', 'Document your changes'],
        commands: [],
        tags: [subtopic.toLowerCase(), 'production'],
      },
    ];
  }
}
