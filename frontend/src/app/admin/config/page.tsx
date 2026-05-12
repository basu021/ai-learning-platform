"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  Mail,
  Key,
  Brain,
  Globe,
  Save,
  Send,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  EyeOff,
} from "lucide-react";
import { configApi, authApi } from "@/lib/api";
import type { SiteConfigData, EmailLogData } from "@/lib/api";

interface ConfigField {
  key: string;
  label: string;
  category: string;
  type: "text" | "password" | "number" | "select";
  placeholder?: string;
  options?: string[];
}

const CONFIG_FIELDS: ConfigField[] = [
  // SMTP
  { key: "SMTP_HOST", label: "SMTP Host", category: "smtp", type: "text", placeholder: "smtp.hostinger.com" },
  { key: "SMTP_PORT", label: "SMTP Port", category: "smtp", type: "number", placeholder: "465" },
  { key: "SMTP_SECURE", label: "SMTP Secure (SSL/TLS)", category: "smtp", type: "select", options: ["true", "false"] },
  { key: "SMTP_USER", label: "SMTP Username", category: "smtp", type: "text", placeholder: "noreply@yourdomain.com" },
  { key: "SMTP_PASSWORD", label: "SMTP Password", category: "smtp", type: "password", placeholder: "Enter SMTP password" },
  { key: "SMTP_FROM_NAME", label: "From Name", category: "smtp", type: "text", placeholder: "SkillForge" },
  { key: "SMTP_FROM_EMAIL", label: "From Email", category: "smtp", type: "text", placeholder: "noreply@yourdomain.com" },
  // AI
  { key: "AI_PROVIDER", label: "AI Provider", category: "ai", type: "select", options: ["openai", "gemini", "claude", "ollama"] },
  { key: "OPENAI_API_KEY", label: "OpenAI API Key", category: "ai", type: "password", placeholder: "sk-..." },
  { key: "OPENAI_MODEL", label: "OpenAI Model", category: "ai", type: "text", placeholder: "gpt-4o-mini" },
  { key: "GEMINI_API_KEY", label: "Gemini API Key", category: "ai", type: "password", placeholder: "Enter Gemini key" },
  { key: "CLAUDE_API_KEY", label: "Claude API Key", category: "ai", type: "password", placeholder: "Enter Claude key" },
  { key: "OLLAMA_BASE_URL", label: "Ollama Base URL", category: "ai", type: "text", placeholder: "http://localhost:11434" },
  // Auth
  { key: "GOOGLE_CLIENT_ID", label: "Google Client ID", category: "auth", type: "text", placeholder: "Enter Google Client ID" },
  { key: "GOOGLE_CLIENT_SECRET", label: "Google Client Secret", category: "auth", type: "password", placeholder: "Enter Google Client Secret" },
  { key: "GOOGLE_CALLBACK_URL", label: "Google Callback URL", category: "auth", type: "text", placeholder: "http://localhost:3001/api/auth/google/callback" },
  { key: "JWT_SECRET", label: "JWT Secret", category: "auth", type: "password", placeholder: "Enter JWT secret" },
  // App
  { key: "FRONTEND_URL", label: "Frontend URL", category: "app", type: "text", placeholder: "http://localhost:3000" },
  { key: "REDIS_URL", label: "Redis URL", category: "app", type: "text", placeholder: "redis://localhost:6379" },
];

const CATEGORY_CONFIG = {
  smtp: { label: "SMTP / Email (Hostinger)", icon: Mail, color: "text-emerald-400" },
  ai: { label: "AI Providers", icon: Brain, color: "text-indigo-400" },
  auth: { label: "Authentication", icon: Key, color: "text-amber-400" },
  app: { label: "Application", icon: Globe, color: "text-cyan-400" },
};

export default function AdminConfigPage() {
  const [configs, setConfigs] = useState<SiteConfigData[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailLogData[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [setupKey, setSetupKey] = useState("");
  const [promoteLoading, setPromoteLoading] = useState(false);
  const [promoteMessage, setPromoteMessage] = useState("");

  const loadConfigs = useCallback(async () => {
    try {
      const data = await configApi.getAll();
      setConfigs(data);
      const values: Record<string, string> = {};
      data.forEach((c) => {
        values[c.key] = c.value;
      });
      setFormValues(values);
    } catch {
      // not admin or not logged in
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    authApi.profile().then((data) => {
      setIsAdmin(data.role === "admin");
      if (data.role === "admin") {
        void loadConfigs();
        configApi.getEmailLogs(1, 10).then((res) => setEmailLogs(res.logs)).catch(() => {});
      } else {
        setLoading(false);
      }
    }).catch(() => setLoading(false));
  }, [loadConfigs]);

  const handleSaveCategory = async (category: string) => {
    setSaving(category);
    try {
      const fields = CONFIG_FIELDS.filter((f) => f.category === category);
      const updates = fields
        .filter((f) => formValues[f.key] !== undefined && formValues[f.key] !== "")
        .map((f) => ({
          key: f.key,
          value: formValues[f.key],
          category: f.category,
          label: f.label,
          encrypted: f.type === "password",
        }));
      if (updates.length > 0) {
        await configApi.bulkUpsert(updates);
        await loadConfigs();
      }
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      setSaving(null);
    }
  };

  const handleTestSmtp = async () => {
    if (!testEmail) return;
    setTestResult(null);
    try {
      const result = await configApi.testSmtp(testEmail);
      setTestResult({
        success: result.success,
        message: result.success ? "Test email sent successfully!" : "Failed to send test email. Check your SMTP settings.",
      });
      configApi.getEmailLogs(1, 10).then((res) => setEmailLogs(res.logs)).catch(() => {});
    } catch {
      setTestResult({ success: false, message: "Failed to send test email." });
    }
  };

  const handlePromote = async () => {
    setPromoteLoading(true);
    setPromoteMessage("");
    try {
      const result = await configApi.promoteToAdmin(setupKey);
      setPromoteMessage(`Promoted ${result.email} to admin!`);
      setIsAdmin(true);
      void loadConfigs();
    } catch (error) {
      setPromoteMessage(error instanceof Error ? error.message : "Failed to promote");
    } finally {
      setPromoteLoading(false);
    }
  };

  const togglePasswordVisibility = (key: string) => {
    setVisiblePasswords((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto mt-20 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-400" />
              Admin Access Required
            </CardTitle>
            <CardDescription>
              Enter the admin setup key (from ADMIN_SETUP_KEY in .env) to promote your account to admin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="password"
              placeholder="Enter admin setup key"
              value={setupKey}
              onChange={(e) => setSetupKey(e.target.value)}
            />
            <Button onClick={handlePromote} disabled={promoteLoading || !setupKey} className="w-full">
              {promoteLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
              Activate Admin
            </Button>
            {promoteMessage && (
              <p className={`text-sm ${promoteMessage.includes("Promoted") ? "text-emerald-400" : "text-red-400"}`}>
                {promoteMessage}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const categories = Object.keys(CATEGORY_CONFIG) as Array<keyof typeof CATEGORY_CONFIG>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-amber-400" />
          Configuration
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Manage API keys, SMTP settings, and secrets. Values set here override .env defaults.
        </p>
      </div>

      {categories.map((category) => {
        const { label, icon: Icon, color } = CATEGORY_CONFIG[category];
        const fields = CONFIG_FIELDS.filter((f) => f.category === category);

        return (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Icon className={`h-4 w-4 ${color}`} />
                {label}
              </CardTitle>
              <CardDescription>
                {category === "smtp" && "Configure Hostinger SMTP for sending trigger mails to users"}
                {category === "ai" && "Configure AI provider API keys for task generation"}
                {category === "auth" && "Authentication secrets and OAuth credentials"}
                {category === "app" && "General application settings"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.map((field) => {
                const existingConfig = configs.find((c) => c.key === field.key);
                const isSet = !!existingConfig;

                return (
                  <div key={field.key} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-400">{field.label}</label>
                      {isSet && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          configured
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {field.type === "select" ? (
                        <select
                          className="flex-1 h-9 rounded-md border border-gray-800 bg-gray-900 px-3 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none"
                          value={formValues[field.key] || ""}
                          onChange={(e) => setFormValues({ ...formValues, [field.key]: e.target.value })}
                        >
                          <option value="">Select...</option>
                          {field.options?.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex-1 relative">
                          <Input
                            type={field.type === "password" && !visiblePasswords[field.key] ? "password" : "text"}
                            placeholder={field.placeholder}
                            value={formValues[field.key] || ""}
                            onChange={(e) => setFormValues({ ...formValues, [field.key]: e.target.value })}
                          />
                          {field.type === "password" && (
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(field.key)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                            >
                              {visiblePasswords[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              <Button
                onClick={() => handleSaveCategory(category)}
                disabled={saving === category}
                className="w-full mt-2"
              >
                {saving === category ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save {label}
              </Button>
            </CardContent>
          </Card>
        );
      })}

      {/* SMTP Test */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4 text-emerald-400" />
            Test Email
          </CardTitle>
          <CardDescription>Send a test email to verify your SMTP configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="recipient@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleTestSmtp} disabled={!testEmail}>
              <Send className="h-4 w-4 mr-2" />
              Send Test
            </Button>
          </div>
          {testResult && (
            <div className={`flex items-center gap-2 p-3 rounded-lg border ${
              testResult.success
                ? "border-emerald-800 bg-emerald-900/20 text-emerald-400"
                : "border-red-800 bg-red-900/20 text-red-400"
            }`}>
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <span className="text-sm">{testResult.message}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            Recent Email Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {emailLogs.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No emails sent yet</p>
          ) : (
            <div className="space-y-2">
              {emailLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-800 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-300 truncate">{log.subject}</p>
                    <p className="text-gray-500 text-xs">{log.to} &middot; {new Date(log.createdAt).toLocaleString()}</p>
                  </div>
                  <Badge variant={log.status === "sent" ? "default" : log.status === "failed" ? "destructive" : "secondary"}>
                    {log.status === "sent" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                    {log.status === "failed" && <XCircle className="h-3 w-3 mr-1" />}
                    {log.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
