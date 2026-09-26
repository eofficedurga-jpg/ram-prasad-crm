"use server";

import { redirect } from "next/navigation";
import { getDbAsync } from "@/db/client";
import * as t from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { answerQuestion } from "@/domain/qna";
import { getQnaFacts } from "@/server/qna";

export async function askQuestionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const question = String(formData.get("question") ?? "").trim();
  if (!question) redirect("/ask");

  const facts = await getQnaFacts();
  const answer = answerQuestion(question, facts);

  const db = await getDbAsync();
  await db.insert(t.qnaQueryLog).values({
    question,
    matchedIntent: answer.intent,
    params: null,
    answered: answer.answered,
    resultSummary: answer.answer.slice(0, 500),
    actorUserId: user.id,
  });

  redirect(`/ask?q=${encodeURIComponent(question)}`);
}
