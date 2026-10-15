"use client";

import { useEffect, useState } from "react";
import { Tags, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { AdminOnly } from "@/components/layout/admin-only";
import { LibraryPage } from "@/components/content/library-view";
import { categoriesApi, type Category } from "@/lib/api";

function Categories() {
  const toast = useToast();
  const [items, setItems] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const load = () => categoriesApi.list().then(setItems).catch(() => {});
  useEffect(() => {
    void load();
  }, []);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await categoriesApi.create(name);
      setName("");
      void load();
    } catch (err) {
      toast.error(err);
    }
  };
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Tags className="h-4 w-4 text-indigo-400" /> Categories</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((c) => (
          <span key={c.id} className="group inline-flex items-center gap-1.5 rounded-full border border-gray-700 bg-gray-800 py-1 pl-3 pr-1.5 text-xs text-gray-300">
            {c.name} <span className="text-gray-500">{c._count?.subjects ?? 0}</span>
            <button
              onClick={() => confirm(`Delete category ${c.name}? Subjects keep existing without a category.`) && categoriesApi.remove(c.id).then(load).catch(toast.error)}
              className="rounded-full p-0.5 text-gray-500 hover:text-red-400"
              aria-label={`Delete ${c.name}`}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        ))}
        <form onSubmit={add} className="flex gap-1.5">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category" className="h-8 w-40 text-xs" />
          <Button size="sm" type="submit" disabled={!name.trim()}>Add</Button>
        </form>
      </div>
    </div>
  );
}

export default function AdminContentPage() {
  return (
    <AdminOnly>
      <div className="space-y-6">
        <LibraryPage adminAll />
        <Categories />
      </div>
    </AdminOnly>
  );
}
