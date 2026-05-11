"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Sliders, Clock, Target, RefreshCw } from "lucide-react";
import { authApi } from "@/lib/api";

export default function SettingsPage() {
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    dailyTaskCount: 5,
    dailyHours: 2,
    difficulty: "beginner",
    revisionFreq: 3,
    repInterval: 7,
  });

  useEffect(() => {
    authApi.profile().then((data) => {
      setProfile({
        name: data.name,
        email: data.email,
        dailyTaskCount: data.dailyTaskCount,
        dailyHours: data.dailyHours,
        difficulty: data.difficulty,
        revisionFreq: 3,
        repInterval: 7,
      });
    }).catch(() => {});
  }, []);

  const difficulties = ["beginner", "intermediate", "advanced", "expert"];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6 text-indigo-400" />
          Settings
        </h1>
        <p className="text-gray-400 text-sm mt-1">Configure your learning preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Name</label>
            <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Email</label>
            <Input value={profile.email} disabled className="opacity-50" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sliders className="h-4 w-4 text-indigo-400" />
            Learning Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="text-sm text-gray-400 mb-2 block flex items-center gap-2">
              <Target className="h-3.5 w-3.5" />
              Daily Task Count: {profile.dailyTaskCount}
            </label>
            <input
              type="range"
              min={1}
              max={20}
              value={profile.dailyTaskCount}
              onChange={(e) => setProfile({ ...profile, dailyTaskCount: Number(e.target.value) })}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>1</span>
              <span>20</span>
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              Daily Learning Hours: {profile.dailyHours}h
            </label>
            <input
              type="range"
              min={0.5}
              max={8}
              step={0.5}
              value={profile.dailyHours}
              onChange={(e) => setProfile({ ...profile, dailyHours: Number(e.target.value) })}
              className="w-full accent-indigo-500"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block">Difficulty Level</label>
            <div className="flex gap-2">
              {difficulties.map((d) => (
                <Button
                  key={d}
                  size="sm"
                  variant={profile.difficulty === d ? "default" : "outline"}
                  onClick={() => setProfile({ ...profile, difficulty: d })}
                  className="capitalize flex-1"
                >
                  {d}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5" />
              Revision Interval: {profile.repInterval} days
            </label>
            <input
              type="range"
              min={1}
              max={30}
              value={profile.repInterval}
              onChange={(e) => setProfile({ ...profile, repInterval: Number(e.target.value) })}
              className="w-full accent-indigo-500"
            />
          </div>

          <Button className="w-full">Save Preferences</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Provider</CardTitle>
          <CardDescription>Configure your AI task generation provider</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {["OpenAI", "Gemini", "Claude", "Ollama"].map((provider) => (
            <div
              key={provider}
              className="flex items-center justify-between p-3 rounded-lg border border-gray-800 hover:border-gray-700 transition-all cursor-pointer"
            >
              <span className="text-sm">{provider}</span>
              <Badge variant={provider === "OpenAI" ? "default" : "secondary"}>
                {provider === "OpenAI" ? "Active" : "Configure"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
