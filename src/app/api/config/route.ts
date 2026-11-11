export async function GET() {
  return Response.json(
    {
      openai: !!process.env.OPENAI_API_KEY,
      openalex: !!process.env.OPENALEX_API_KEY,
      semanticScholar: !!process.env.SEMANTIC_SCHOLAR_API_KEY,
      supabase: !!(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      ),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
