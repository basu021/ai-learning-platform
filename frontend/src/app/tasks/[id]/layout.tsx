export function generateStaticParams() {
  return [{ id: "view" }];
}

export default function TaskDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
