import { supabase } from "@/integrations/supabase/client";

let cachedVars: Record<string, string> | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000; // 1 min

export async function loadDynamicVariables(userId: string): Promise<Record<string, string>> {
  if (cachedVars && Date.now() - cacheTime < CACHE_TTL) return cachedVars;

  const { data } = await supabase
    .from("dynamic_variables")
    .select("key, value")
    .eq("user_id", userId);

  const vars: Record<string, string> = {};
  data?.forEach((v) => { vars[v.key] = v.value; });

  // Add built-in variables
  vars["date"] = new Date().toLocaleDateString();
  vars["year"] = new Date().getFullYear().toString();

  cachedVars = vars;
  cacheTime = Date.now();
  return vars;
}

export function replaceVariables(text: string, variables: Record<string, string>, contactData?: Record<string, string>): string {
  const allVars = { ...variables, ...contactData };
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => allVars[key] || match);
}

export function clearVariableCache() {
  cachedVars = null;
  cacheTime = 0;
}
