import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Crumb } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Subject › Chapter › Topic › Subtopic */
export function Breadcrumb({
  items,
  subjectId,
  linked = true,
  className,
}: {
  items: Crumb[];
  subjectId?: string;
  linked?: boolean;
  className?: string;
}) {
  const sid = subjectId ?? items.find((i) => i.type === "SUBJECT")?.id;
  return (
    <nav className={cn("flex min-w-0 flex-wrap items-center gap-1 text-xs text-gray-500", className)}>
      {items.map((c, i) => {
        const href = c.type === "SUBJECT" ? `/subjects/${c.id}` : `/subjects/${sid}?node=${c.id}`;
        const last = i === items.length - 1;
        return (
          <span key={c.id} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-gray-600" />}
            {linked && sid ? (
              <Link href={href} className={cn("truncate hover:text-indigo-300", last && "text-gray-300")}>
                {c.title}
              </Link>
            ) : (
              <span className={cn("truncate", last && "text-gray-300")}>{c.title}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
