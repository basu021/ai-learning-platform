export function generateStaticParams() {
  return [{ id: "view" }];
}

export default function AdminUserDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
