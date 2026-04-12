"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import HeroBanner from "@/components/layout/HeroBanner";
import type { UserSettings } from "@/types/settings";
import { DEFAULT_SETTINGS } from "@/types/settings";

const SETTINGS_KEY = "mtg-houdini-settings";

function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: UserSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

export default function SettingsPageClient() {
  const { user, isSignedIn } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    setMounted(true);
  }, []);

  const updateSetting = useCallback(
    <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        saveSettings(next);
        return next;
      });
    },
    []
  );

  function handleClearAll() {
    // Clear guest localStorage data
    Object.keys(localStorage)
      .filter((k) => k.startsWith("mtg_guest_"))
      .forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem(SETTINGS_KEY);
    setSettings(DEFAULT_SETTINGS);
    setShowClearConfirm(false);
  }

  if (!mounted) return null;

  const MORE_ICON = (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );

  return (
    <div className="flex flex-col min-h-screen pb-20">
      <HeroBanner
        title="More"
        subtitle="Settings & account — MTG Houdini v0.1.0"
        accent="#A855F7"
        icon={MORE_ICON}
      />

      <div className="px-4 mt-4 space-y-6">
        {/* Account section */}
        <section>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Account</h2>
          {isSignedIn && user ? (
            <div className="bg-bg-card rounded-xl border border-border p-4 flex items-center gap-3">
              {user.imageUrl && (
                <img src={user.imageUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">{user.fullName || user.username || "User"}</p>
                <p className="text-xs text-text-muted truncate">{user.primaryEmailAddress?.emailAddress}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => openUserProfile()}
                  className="text-xs text-accent hover:text-accent-dark transition-colors font-medium"
                >
                  Edit Profile
                </button>
                <button
                  onClick={() => signOut()}
                  className="text-xs text-text-muted hover:text-banned transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-bg-card rounded-xl border border-border p-4">
              <p className="text-sm text-text-secondary mb-1">You&apos;re using guest mode</p>
              <p className="text-xs text-text-muted mb-3">Your data is saved on this device only. Sign in to sync across devices.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push("/sign-in")}
                  className="flex-1 py-2 rounded-lg bg-accent text-black text-sm font-semibold hover:bg-accent-dark transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => router.push("/sign-up")}
                  className="flex-1 py-2 rounded-lg bg-bg-hover border border-border text-text-primary text-sm font-medium hover:border-accent/40 transition-colors"
                >
                  Create Account
                </button>
              </div>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Display</h2>
          <div className="bg-bg-card rounded-xl border border-border px-4 divide-y divide-border">
            <SettingRow label="Default Search View">
              <Select value={settings.defaultSearchView} onChange={(v) => updateSetting("defaultSearchView", v as UserSettings["defaultSearchView"])} options={[{ value: "grid", label: "Grid" }, { value: "list", label: "List" }]} />
            </SettingRow>
            <SettingRow label="Card Image Quality">
              <Select value={settings.cardImageQuality} onChange={(v) => updateSetting("cardImageQuality", v as UserSettings["cardImageQuality"])} options={[{ value: "small", label: "Small" }, { value: "normal", label: "Normal" }, { value: "large", label: "Large" }]} />
            </SettingRow>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Pricing</h2>
          <div className="bg-bg-card rounded-xl border border-border px-4 divide-y divide-border">
            <SettingRow label="Preferred Currency">
              <Select value={settings.preferredCurrency} onChange={(v) => updateSetting("preferredCurrency", v as UserSettings["preferredCurrency"])} options={[{ value: "usd", label: "USD ($)" }, { value: "eur", label: "EUR (€)" }, { value: "tix", label: "TIX" }]} />
            </SettingRow>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Life Counter</h2>
          <div className="bg-bg-card rounded-xl border border-border px-4 divide-y divide-border">
            <SettingRow label="Default Starting Life">
              <Select value={String(settings.defaultStartingLife)} onChange={(v) => updateSetting("defaultStartingLife", parseInt(v, 10))} options={[{ value: "20", label: "20" }, { value: "40", label: "40" }]} />
            </SettingRow>
            <SettingRow label="Default Player Count">
              <Select value={String(settings.defaultPlayerCount)} onChange={(v) => updateSetting("defaultPlayerCount", parseInt(v, 10))} options={[{ value: "2", label: "2 Players" }, { value: "3", label: "3 Players" }, { value: "4", label: "4 Players" }]} />
            </SettingRow>
          </div>
        </section>

        {!isSignedIn && (
          <section>
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Data</h2>
            <div className="bg-bg-card rounded-xl border border-border px-4 divide-y divide-border">
              <SettingRow label="Clear Guest Data" description="Delete all locally stored decks, binders, and cards">
                <Button variant="danger" size="sm" onClick={() => setShowClearConfirm(true)}>Clear</Button>
              </SettingRow>
            </div>
          </section>
        )}

        <section className="pb-8">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">About</h2>
          <div className="bg-bg-card rounded-xl border border-border p-4">
            <p className="text-sm text-text-secondary">MTG Houdini is your ultimate Magic: The Gathering companion app.</p>
            <p className="text-sm text-text-muted mt-3">Designed by Dan Lopez</p>
          </div>
        </section>
      </div>

      <Modal open={showClearConfirm} onClose={() => setShowClearConfirm(false)} title="Clear All Data?">
        <p className="text-sm text-text-secondary mb-4">This will permanently delete all your data. This action cannot be undone.</p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={() => setShowClearConfirm(false)}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={handleClearAll}>Delete Everything</Button>
        </div>
      </Modal>
    </div>
  );
}
