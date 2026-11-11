import { ResearchView } from "@/components/research-view";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ResearchView id={id} view="challenge" />;
}
