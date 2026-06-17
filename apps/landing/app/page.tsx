import { Button } from "@repo/ui";

export default function Page() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
      <div className="max-w-xl text-center space-y-6">
        <h1 className="text-5xl font-extrabold tracking-tight text-slate-900">
          Engenhariainversa Landing Page
        </h1>
        <p className="text-lg text-slate-600">
          This page is built in Next.js and uses visual components imported from
          our shared Monorepo UI system.
        </p>
        <div className="flex gap-4 justify-center">
          <Button variant="primary">Explore Features</Button>
          <Button variant="outline">Learn More</Button>
        </div>
      </div>
    </main>
  );
}
