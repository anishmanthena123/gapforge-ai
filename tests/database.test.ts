import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { makeProject } from "../src/lib/model";
import { heuristicConcepts } from "../src/lib/server/ai";
import { paper, input } from "./fixtures";
const alice = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222";
const project = makeProject(input, {
  papers: [paper()],
  queries: ["fixture query"],
  concepts: heuristicConcepts(input),
  warnings: [],
  assessment: null,
});
project.notes = "Alice private note";
project.bookmarks = [paper().id];
let db: PGlite;
async function as(user: string) {
  await db.exec(
    `reset role; set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);`,
  );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated,anon; insert into auth.users values('${alice}'),('${bob}');`,
  );
  const file = readdirSync("supabase/migrations").find((f) =>
    f.endsWith("_gapforge_foundation.sql"),
  )!;
  await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  await as(alice);
  await db.query("select public.save_research_project($1::jsonb)", [
    JSON.stringify(project),
  ]);
});
afterAll(async () => {
  await db?.close();
});
describe("normalized storage and database-enforced ownership", () => {
  it("applies RLS to all 15 exposed tables", async () => {
    await db.exec("reset role");
    const result = await db.query<{ tablename: string; rowsecurity: boolean }>(
      "select tablename,rowsecurity from pg_tables where schemaname='public'",
    );
    expect(result.rows).toHaveLength(15);
    expect(result.rows.every((r) => r.rowsecurity)).toBe(true);
  });
  it("roundtrips private notes, bookmark and provider metadata", async () => {
    await as(alice);
    const notes = await db.query<{ content: string }>(
      "select content from public.project_notes",
    );
    expect(notes.rows[0].content).toBe("Alice private note");
    const papers = await db.query<{ title: string }>(
      "select title from public.papers",
    );
    expect(papers.rows[0].title).toContain("TEST FIXTURE");
    const links = await db.query<{ bookmarked: boolean }>(
      "select bookmarked from public.project_papers",
    );
    expect(links.rows[0].bookmarked).toBe(true);
  });
  it("retries atomically without duplicated papers or queries", async () => {
    await as(alice);
    await db.query("select public.save_research_project($1::jsonb)", [
      JSON.stringify(project),
    ]);
    expect((await db.query("select * from public.papers")).rows).toHaveLength(
      1,
    );
    expect(
      (await db.query("select * from public.research_queries")).rows,
    ).toHaveLength(1);
  });
  it("hides every Alice-owned row from Bob", async () => {
    await as(bob);
    for (const table of [
      "research_projects",
      "papers",
      "project_papers",
      "paper_identifiers",
      "paper_references",
      "project_notes",
      "research_queries",
    ])
      expect(
        (await db.query(`select * from public.${table}`)).rows,
      ).toHaveLength(0);
  });
  it("rejects ownership reassignment", async () => {
    await as(alice);
    await expect(
      db.query("update public.research_projects set owner_id=$1 where id=$2", [
        bob,
        project.id,
      ]),
    ).rejects.toThrow(/row-level security/i);
  });
  it("prevents cross-owner child rows even with the attacker as owner", async () => {
    await as(bob);
    await expect(
      db.query(
        "insert into public.analysis_jobs(project_id,owner_id,status,input) values($1,$2,'queued',$3::jsonb)",
        [project.id, bob, "{}"],
      ),
    ).rejects.toThrow(/foreign key/i);
  });
  it("prevents an attacker from overwriting a known project UUID through the save RPC", async () => {
    await as(bob);
    await expect(
      db.query("select public.save_research_project($1::jsonb)", [
        JSON.stringify({ ...project, notes: "attack" }),
      ]),
    ).rejects.toThrow(/row-level security/i);
  });
  it("denies anonymous private reads and RPC execution", async () => {
    await db.exec("reset role; set role anon");
    await expect(
      db.query("select * from public.research_projects"),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      db.query("select public.save_research_project($1::jsonb)", [
        JSON.stringify(project),
      ]),
    ).rejects.toThrow(/permission denied/i);
  });
});
