import { useAuth } from "@/_core/hooks/useAuth";
import { CaspaShell } from "@/components/CaspaShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parseCaspaError } from "@/lib/caspaError";
import { trpc } from "@/lib/trpc";
import { reviewDimensions } from "@shared/collaboration";
import { Check, EyeOff, Loader2, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

export default function BlindReviewPage() {
  const { isAuthenticated, loading } = useAuth();
  const [, params] = useRoute("/reviews/:id"); const [, setLocation] = useLocation(); const reviewRoundId = Number(params?.id || 0);
  const review = trpc.collaboration.reviewerRound.useQuery({ reviewRoundId }, { enabled: isAuthenticated && reviewRoundId > 0 });
  const [ratings, setRatings] = useState<Record<string, number>>(() => Object.fromEntries(reviewDimensions.map(dimension => [dimension, 3])));
  const [feedback, setFeedback] = useState("");
  const submit = trpc.collaboration.submitReview.useMutation({ onSuccess: () => { toast.success("Your blind review is sealed."); setLocation("/"); }, onError: error => toast.error(parseCaspaError(error, "Your review could not be submitted.").message) });
  if (loading) return <div className="grid min-h-screen place-items-center bg-background"><Loader2 className="size-7 animate-spin text-primary" /></div>;
  if (!isAuthenticated) { setLocation("/"); return null; }
  if (review.isError || !review.data) return <CaspaShell><div className="container py-16 text-center"><EyeOff className="mx-auto size-7 text-primary" /><h1 className="mt-4 text-4xl font-semibold">This review is unavailable.</h1><p className="mt-3 text-sm text-muted-foreground">Sign in with the invited account and confirm that the round is still open.</p><Button variant="outline" className="mt-6" onClick={() => setLocation("/")}>Return to writing desk</Button></div></CaspaShell>;
  return <CaspaShell><div className="container py-8 sm:py-10"><section className="literary-card p-6 sm:p-8"><p className="eyebrow">Blind editorial review · {review.data.reviewerLabel}</p><h1 className="mt-2 text-5xl font-semibold">{review.data.manuscriptLabel}</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">Contributor and author identifiers are withheld. Rate the fixed manuscript version as you received it; your response is immutable once submitted.</p><div className="my-7 gold-rule" /><div className="max-h-[45vh] overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-black/15 p-5 font-serif text-sm leading-7 text-foreground/90">{review.data.manuscript}</div><div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{reviewDimensions.map(dimension => <label key={dimension} className="rounded-xl border border-border bg-black/10 p-4"><span className="block text-sm font-semibold capitalize">{dimension.replace(/-/g, " ")}</span><select value={ratings[dimension]} onChange={event => setRatings(current => ({ ...current, [dimension]: Number(event.target.value) }))} className="mt-3 h-9 w-full rounded-md border border-border bg-card px-2 text-sm">{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} / 5</option>)}</select></label>)}</div><div className="mt-6"><Textarea value={feedback} onChange={event => setFeedback(event.target.value)} className="min-h-40 bg-black/15 leading-7" placeholder="Private editorial feedback. Avoid author-identifying speculation." /></div><div className="mt-5 flex justify-end"><Button disabled={feedback.trim().length < 20 || submit.isPending} onClick={() => submit.mutate({ reviewRoundId, ratings: ratings as any, feedback: feedback.trim() })}>{submit.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Submit sealed review</Button></div></section></div></CaspaShell>;
}
