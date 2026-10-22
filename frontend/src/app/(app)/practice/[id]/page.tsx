import PracticeView from "./view";

// Static builds export a single placeholder page that the host serves for
// every id; regular (server) builds render any id on demand.
export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function Page() {
  return <PracticeView />;
}
