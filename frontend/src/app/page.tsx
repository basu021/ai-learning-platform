"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Brain,
  Zap,
  Target,
  Flame,
  BookOpen,
  Terminal,
  Shield,
  Database,
  Server,
  Cloud,
} from "lucide-react";

const subjects = [
  { name: "Linux Administration", icon: Terminal, color: "from-orange-500 to-red-500" },
  { name: "PostgreSQL DBA", icon: Database, color: "from-blue-500 to-cyan-500" },
  { name: "DevOps", icon: Zap, color: "from-green-500 to-emerald-500" },
  { name: "Kubernetes", icon: Cloud, color: "from-indigo-500 to-purple-500" },
  { name: "Security Hardening", icon: Shield, color: "from-red-500 to-pink-500" },
  { name: "Server Management", icon: Server, color: "from-yellow-500 to-orange-500" },
];

const features = [
  {
    icon: Brain,
    title: "AI-Powered Tasks",
    description: "Automatically generated practical tasks that adapt to your skill level and learning pace.",
  },
  {
    icon: Target,
    title: "Spaced Repetition",
    description: "Intelligent revision scheduling ensures concepts move from short-term to long-term memory.",
  },
  {
    icon: Flame,
    title: "Streak System",
    description: "Build daily streaks, earn XP, unlock achievements, and track your mastery journey.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 bg-grid">
      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/20 via-transparent to-transparent" />
        <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              SkillForge
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login">
              <Button variant="ghost">Log In</Button>
            </Link>
            <Link href="/auth/register">
              <Button>Get Started</Button>
            </Link>
          </div>
        </nav>

        <div className="relative z-10 max-w-4xl mx-auto px-6 py-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-4 py-1.5 mb-6">
              <Zap className="h-3.5 w-3.5 text-indigo-400" />
              <span className="text-xs font-medium text-indigo-300">
                AI-Powered Technical Training
              </span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              Master Technical Skills{" "}
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Like a Pro
              </span>
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10">
              AI-generated practice tasks, spaced repetition, and gamified progression
              for Linux admins, DBAs, DevOps engineers, and infrastructure professionals.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link href="/auth/register">
                <Button size="lg" className="px-8">
                  Start Learning Free
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button size="lg" variant="outline">
                  <BookOpen className="mr-2 h-4 w-4" />
                  View Demo
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </header>

      {/* Subjects */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center mb-3">Training Paths</h2>
        <p className="text-gray-400 text-center mb-10">
          Structured learning for production-grade skills
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {subjects.map((subject, i) => (
            <motion.div
              key={subject.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="group relative rounded-xl border border-gray-800 bg-gray-900/50 p-6 hover:border-gray-700 transition-all duration-300 cursor-pointer"
            >
              <div
                className={`inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${subject.color} mb-3`}
              >
                <subject.icon className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-semibold text-gray-200 mb-1">{subject.name}</h3>
              <p className="text-xs text-gray-500">Hands-on labs &amp; tasks</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="rounded-xl border border-gray-800 bg-gray-900/30 p-6"
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 mb-4">
                <feature.icon className="h-5 w-5 text-indigo-400" />
              </div>
              <h3 className="font-semibold text-gray-200 mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-400">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 text-center">
        <p className="text-sm text-gray-500">
          SkillForge &mdash; AI-Powered Technical Training Platform
        </p>
      </footer>
    </div>
  );
}
