// app/dashboard/page.tsx
"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function Dashboard() {
  const [me, setMe] = useState<any>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api("/api/me").then(setMe).catch(e => setErr(e.message));
  }, []);

  if (err) return <p className="text-red-600">{err}</p>;
  if (!me) return <p>Loading…</p>;
  return <pre className="p-4 border rounded">{JSON.stringify(me, null, 2)}</pre>;
}
