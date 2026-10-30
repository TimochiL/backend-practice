const frameworks = ["Node.js", "Django", "Spring Boot"];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-16 sm:px-10">
      <p className="mb-4 font-mono text-sm font-semibold tracking-[0.2em] text-sky-700 uppercase">
        Backend Practice
      </p>
      <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
        The workspace is ready.
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
        The first application scaffold is running. Framework selection, coding
        problems, and progress tracking will arrive in the next build steps.
      </p>

      <section aria-labelledby="frameworks-heading" className="mt-12">
        <h2
          id="frameworks-heading"
          className="text-sm font-medium text-slate-500"
        >
          Planned practice environments
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {frameworks.map((framework) => (
            <li
              key={framework}
              className="rounded-xl border border-slate-200 bg-white px-5 py-4 font-medium text-slate-900 shadow-sm"
            >
              {framework}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
