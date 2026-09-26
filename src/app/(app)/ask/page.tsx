import Link from "next/link";
import { answerQuestion, suggestedQuestions } from "@/domain/qna";
import { getQnaFacts } from "@/server/qna";
import { askQuestionAction } from "@/app/actions/qna";

export const dynamic = "force-dynamic";

export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const facts = await getQnaFacts();
  const answer = q ? answerQuestion(q, facts) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Ask your data</h1>
        <p className="text-sm muted">
          Answers come from stored records only. If a question cannot be matched to data, it says so.
        </p>
      </div>

      <form action={askQuestionAction} className="card card-pad flex flex-wrap gap-2">
        <input className="input flex-1 min-w-[240px]" name="question" placeholder='e.g. "why did we lose them?"' defaultValue={q ?? ""} />
        <button className="btn-primary" type="submit">
          Ask
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {suggestedQuestions().map((s) => (
          <Link key={s} href={`/ask?q=${encodeURIComponent(s)}`} className="badge bg-slate-100 text-slate-700 hover:bg-slate-200">
            {s}
          </Link>
        ))}
      </div>

      {answer ? (
        <div className={`card card-pad ${answer.answered ? "" : "border-amber-300"}`}>
          <p className="text-sm font-medium">{q}</p>
          <p className="mt-2 text-sm">{answer.answer}</p>
          {answer.detail && answer.detail.length > 0 ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
              {answer.detail.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          ) : null}
          <p className="mt-3 text-xs muted">Matched intent: {answer.intent} · month: {facts.monthLabel}</p>
        </div>
      ) : null}

      <div className="card card-pad">
        <h2 className="card-title mb-2">What it can answer right now</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {suggestedQuestions().map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
