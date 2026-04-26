"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";

export interface UserProfile {
  id: string;
  userId: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  discoverable: boolean;
  createdAt: string;
}

export function useProfile() {
  const { isSignedIn } = useUser();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSignedIn) { setLoading(false); return; }
    setLoading(true);
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.id) setProfile(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isSignedIn]);

  const updateProfile = useCallback(async (changes: { displayName?: string; discoverable?: boolean }) => {
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      const updated = await res.json();
      if (updated.id) setProfile(updated);
      return updated as UserProfile;
    } catch { return null; }
  }, []);

  return { profile, loading, updateProfile };
}
