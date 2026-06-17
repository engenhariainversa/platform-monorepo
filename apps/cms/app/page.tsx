import { Button } from "@repo/ui";

export default function Page() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
      <div className="max-w-xl text-center space-y-6">
        <h1 className="text-5xl font-extrabold tracking-tight text-white">
          Engenhariainversa CMS
        </h1>
        <p className="text-lg text-slate-400">
          This is the CMS administration dashboard. Create pages, edit fields,
          and manage custom content pipelines.
        </p>
        <div className="flex gap-4 justify-center">
          <Button variant="primary">Create New Page</Button>
          <Button variant="secondary">View Dashboard</Button>
        </div>
      </div>
    </main>
  );
}
