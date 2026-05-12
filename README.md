# SkillForge - AI-Powered Technical Training Platform

A modern, gamified learning and practice management platform for technical skill training. Built for system administrators, DBAs, DevOps engineers, and infrastructure professionals.

## Features

- **Hierarchical Learning Model**: Subject → Topic → Subtopic → Practice Tasks
- **AI-Generated Tasks**: Practical, scenario-based, command-focused tasks using OpenAI/Gemini/Claude/Ollama
- **Spaced Repetition**: Intelligent revision scheduling for long-term retention
- **Task Timer & Feedback**: Track time spent, submit detailed feedback, AI analyzes and adapts
- **Gamification**: XP system, levels, streaks, achievements, daily quests, skill mastery tracking
- **Activity Heatmap**: GitHub-style contribution graph for learning activity
- **Daily Task Queue**: Auto-generated daily practice queues based on progress and weak areas
- **Dark Cyberpunk Theme**: Modern SaaS UI inspired by Duolingo, Linear, and GitHub dark mode

## Tech Stack

### Backend
- **NestJS** with TypeScript
- **Prisma ORM** with MySQL
- **JWT Authentication** + Google OAuth
- **RESTful API** architecture

### Frontend
- **Next.js 16** with App Router
- **TypeScript** + **TailwindCSS**
- **ShadCN-style UI** components
- **Framer Motion** animations
- **Recharts** for data visualization

### Infrastructure
- **MySQL 8.0** database
- **Redis** for caching/queues
- **Docker Compose** for local development

## Quick Start

### Prerequisites
- Node.js 22+
- MySQL 8.0
- Redis (optional)

### Using Docker Compose

```bash
docker-compose up -d
```

### Manual Setup

1. **Clone and install:**
```bash
git clone <repo-url>
cd ai-learning-platform

# Backend
cd backend
npm install
cp .env.example .env  # Configure your database URL
npx prisma generate
npx prisma db push
npm run start:dev

# Frontend (in new terminal)
cd frontend
npm install
npm run dev
```

2. **Access the app:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## Project Structure

```
ai-learning-platform/
├── backend/                  # NestJS backend
│   ├── src/
│   │   ├── auth/            # JWT + Google OAuth authentication
│   │   ├── subjects/        # Subject CRUD
│   │   ├── topics/          # Topic CRUD
│   │   ├── subtopics/       # Subtopic CRUD
│   │   ├── tasks/           # Task lifecycle management
│   │   ├── feedback/        # Task feedback & learning progress
│   │   ├── ai/              # AI provider abstraction layer
│   │   ├── gamification/    # XP, levels, streaks, achievements
│   │   ├── scheduler/       # Daily task queue generation
│   │   ├── dashboard/       # Dashboard data aggregation
│   │   ├── prisma/          # Database service
│   │   └── common/          # Decorators, filters, pipes
│   └── prisma/
│       └── schema.prisma    # Database schema
├── frontend/                 # Next.js frontend
│   └── src/
│       ├── app/             # App router pages
│       │   ├── auth/        # Login, register, OAuth callback
│       │   ├── dashboard/   # Main dashboard
│       │   ├── subjects/    # Subject management
│       │   ├── tasks/       # Task list & detail views
│       │   └── settings/    # User preferences
│       ├── components/      # Reusable components
│       │   ├── ui/          # ShadCN-style base components
│       │   └── layout/      # Sidebar, topbar
│       └── lib/             # Utilities, API client, types
├── docker-compose.yml
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `GET /api/auth/google` - Google OAuth redirect
- `GET /api/auth/google/callback` - Google OAuth callback
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout
- `GET /api/auth/profile` - Get user profile

### Subjects, Topics, Subtopics
- `GET/POST /api/subjects` - List/create subjects
- `GET/PUT/DELETE /api/subjects/:id` - Get/update/delete subject
- `GET/POST /api/topics` - List/create topics
- `GET/POST /api/subtopics` - List/create subtopics

### Tasks
- `GET /api/tasks/today` - Today's task queue
- `GET /api/tasks/my` - User's tasks (filterable by status)
- `GET /api/tasks/:id` - Task detail
- `POST /api/tasks/:id/start` - Start task timer
- `POST /api/tasks/session/:id/finish` - Finish task session
- `PUT /api/tasks/:id/status` - Update task status

### AI & Scheduling
- `POST /api/ai/generate/:subtopicId` - Generate AI tasks
- `POST /api/ai/analyze/:taskId` - Analyze feedback
- `POST /api/scheduler/generate-daily` - Generate daily queue

### Gamification
- `GET /api/gamification/stats` - XP, level, streaks, achievements
- `GET /api/gamification/heatmap` - Activity heatmap data

### Dashboard
- `GET /api/dashboard` - Complete dashboard data

## Database Schema

15+ tables including: users, subjects, topics, subtopics, tasks, task_sessions, feedback, ai_generations, daily_task_queue, streaks, achievements, user_achievements, xp_history, revision_history, learning_progress, notifications.

## AI Provider Configuration

Set your AI provider API key in the backend `.env`:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

The system includes fallback task templates when no API key is configured.

## Environment Variables

### Backend (.env)
```env
DATABASE_URL=mysql://root:password@localhost:3306/ai_learning_platform
JWT_SECRET=your-secret-key
FRONTEND_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
OPENAI_API_KEY=your-openai-key
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## License

MIT
