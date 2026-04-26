"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import type { PlaygroupMember } from "@/types/playgroup";

const LS_KEY = "mtg_playgroup";

function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; }
  catch { return fallback; }
}
function lsSet(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}
function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

export function usePlaygroup() {
  const { isSignedIn } = useUser();
  const [members, setMembers] = useState<PlaygroupMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isSignedIn === undefined) return;
    if (isSignedIn) {
      setLoading(true);
      fetch("/api/playgroup")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setMembers(data);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setMembers(lsGet<PlaygroupMember[]>(LS_KEY, []));
      setLoading(false);
    }
  }, [isSignedIn]);

  const addMember = useCallback(async (name: string, avatarColor: string, notes?: string) => {
    if (isSignedIn) {
      try {
        const res = await fetch("/api/playgroup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, avatarColor, notes }),
        });
        const created = await res.json();
        if (created.id) setMembers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        return created as PlaygroupMember;
      } catch { return null; }
    } else {
      const member: PlaygroupMember = { id: uuid(), name: name.trim(), avatarColor, notes, createdAt: new Date().toISOString() };
      setMembers((prev) => {
        const updated = [...prev, member].sort((a, b) => a.name.localeCompare(b.name));
        lsSet(LS_KEY, updated);
        return updated;
      });
      return member;
    }
  }, [isSignedIn]);

  const updateMember = useCallback(async (id: string, changes: Partial<Omit<PlaygroupMember, "id" | "createdAt">>) => {
    if (isSignedIn) {
      setMembers((prev) => prev.map((m) => m.id === id ? { ...m, ...changes } : m));
      try {
        const res = await fetch("/api/playgroup", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...changes }),
        });
        const updated = await res.json();
        if (updated.id) setMembers((prev) => prev.map((m) => m.id === id ? updated : m));
      } catch {
        fetch("/api/playgroup").then((r) => r.json()).then((data) => {
          if (Array.isArray(data)) setMembers(data);
        }).catch(() => {});
      }
    } else {
      setMembers((prev) => {
        const updated = prev.map((m) => m.id === id ? { ...m, ...changes } : m);
        lsSet(LS_KEY, updated);
        return updated;
      });
    }
  }, [isSignedIn]);

  const deleteMember = useCallback(async (id: string) => {
    if (isSignedIn) {
      setMembers((prev) => prev.filter((m) => m.id !== id));
      try {
        await fetch("/api/playgroup", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
      } catch {
        fetch("/api/playgroup").then((r) => r.json()).then((data) => {
          if (Array.isArray(data)) setMembers(data);
        }).catch(() => {});
      }
    } else {
      setMembers((prev) => {
        const updated = prev.filter((m) => m.id !== id);
        lsSet(LS_KEY, updated);
        return updated;
      });
    }
  }, [isSignedIn]);

  return { members, loading, addMember, updateMember, deleteMember };
}
