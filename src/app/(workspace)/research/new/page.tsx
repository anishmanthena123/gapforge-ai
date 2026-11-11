import { Suspense } from "react";
import { ResearchForm } from "@/components/research-form";
export default function Page() {
  return (
    <Suspense fallback={<div className="skeleton" />}>
      <ResearchForm />
    </Suspense>
  );
}
