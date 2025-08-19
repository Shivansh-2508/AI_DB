import { createClient } from "./client";

export async function getUserEmail() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email || null;
}
