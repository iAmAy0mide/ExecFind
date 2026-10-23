import { leadQuerySchema, type LeadQuery } from "./types";

type SearchLike = { get(name: string): string | null; getAll(name: string): string[] };

export function parseLeadQuery(params: SearchLike, overrides: Partial<LeadQuery> = {}): LeadQuery {
  return leadQuerySchema.parse({
    search: params.get("search") ?? undefined,
    grades: params.getAll("grade"), branches: params.getAll("branch"), reachability: params.getAll("reachability"),
    sort: params.get("sort") ?? undefined, limit: params.get("limit") ?? undefined, offset: params.get("offset") ?? undefined,
    ...overrides,
  });
}

export function queryString(query: LeadQuery) {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  query.grades.forEach((value) => params.append("grade", value));
  query.branches.forEach((value) => params.append("branch", value));
  query.reachability.forEach((value) => params.append("reachability", value));
  params.set("sort", query.sort);
  return params.toString();
}
