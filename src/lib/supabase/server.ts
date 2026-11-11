import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export async function serverSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        for (const { name, value, options } of values)
          store.set(name, value, options);
      },
    },
  });
}
export async function aiAllowed() {
  if (!process.env.OPENAI_API_KEY) return false;
  if (process.env.ALLOW_GUEST_AI === "true") return true;
  const db = await serverSupabase();
  if (!db) return false;
  const { data, error } = await db.auth.getUser();
  return !error && !!data.user;
}
