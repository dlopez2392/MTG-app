"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils/cn";
import { db } from "@/lib/db/index";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import type { UserSettings } from "@/types/settings";
import { DEFAULT_SETTINGS } from "@/types/settings";

const SETTINGS_KEY = "mtg-houdini-settings";

function loadSettings(): UserSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
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

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between py-3 gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {description && (
          <p className="text-xs text-text-muted mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

function Select({ value, onChange, options }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export default function SettingsPage() {
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

  async function handleExport() {
    const binders = await db.binders.toArray();
    const collectionCards = await db.collectionCards.toArray();
    const decks = await db.decks.toArray();
    const deckCards = await db.deckCards.toArray();

    const data = {
      exportedAt: new Date().toISOString(),
      appVersion: "0.1.0",
      settings,
      binders,
      collectionCards,
      decks,
      deckCards,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mtg-houdini-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (data.binders) {
          await db.binders.bulkPut(data.binders);
        }
        if (data.collectionCards) {
          await db.collectionCards.bulkPut(data.collectionCards);
        }
        if (data.decks) {
          await db.decks.bulkPut(data.decks);
        }
        if (data.deckCards) {
          await db.deckCards.bulkPut(data.deckCards);
        }
        if (data.settings) {
          setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
          saveSettings({ ...DEFAULT_SETTINGS, ...data.settings });
        }

        alert("Import successful!");
      } catch {
        alert("Failed to import data. Please check the file format.");
      }
    };
    input.click();
  }

  async function handleClearAll() {
    await db.binders.clear();
    await db.collectionCards.clear();
    await db.decks.clear();
    await db.deckCards.clear();
    await db.deckFolders.clear();
    await db.lifeGames.clear();
    localStorage.removeItem(SETTINGS_KEY);
    setSettings(DEFAULT_SETTINGS);
    setShowClearConfirm(false);
  }

  if (!mounted) {
    return (
      <div className="flex flex-col min-h-screen pb-20">
        <div className="px-4 pt-6 pb-2">
          <h1 className="text-xl font-bold text-text-primary">Settings</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pb-20">
      {/* Header */}
      <div className="px-4 pt-6 pb-2 text-center">
        <h1 className="text-2xl font-bold text-accent">MTG Houdini</h1>
        <p className="text-xs text-text-muted mt-1">Version 0.1.0</p>
      </div>

      <div className="px-4 mt-4 space-y-6">
        {/* Display Section */}
        <section>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
            Display
          </h2>
          <div className="bg-bg-card rounded-xl border border-border px-4 divide-y divide-border">
            <SettingRow label="Default Search View">
              <Select
                value={settings.defaultSearchView}
                onChange={(v) =>
                  updateSetting(
                    "defaultSearchView",
                    v as UserSettings["defaultSearchView"]
                  )
                }
                options={[
                  { value: "grid", label: "Grid" },
                  { value: "list", label: "List" },
                ]}
              />
            </SettingRow>
            <SettingRow label="Card Image Quality">
              <Select
                value={settings.cardImageQuality}
                onChange={(v) =>
                  updateSetting(
                    "cardImageQuality",
                    v as UserSettings["cardImageQuality"]
                  )
                }
                options={[
                  { value: "small", label: "Small" },
                  { value: "normal", label: "Normal" },
                  { value: "large", label: "Large" },
                ]}
              />
            </SettingRow>
          </div>
        </section>

        {/* Pricing Section */}
        <section>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
            Pricing
          </h2>
          <div className="bg-bg-card rounded-xl border border-border px-4 divide-y divide-border">
            <SettingRow label="Preferred Currency">
              <Select
                value={settings.preferredCurrency}
                onChange={(v) =>
                  updateSetting(
                    "preferredCurrency",
                    v as UserSettings["preferredCurrency"]
                  )
                }
                options={[
                  { value: "usd", label: "USD ($)" },
                  { value: "eur", label: "EUR (\u20AC)" },
                  { value: "tix", label: "TIX" },
                ]}
              />
            </SettingRow>
          </div>
        </section>

        {/* Life Counter Section */}
        <section>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
            Life Counter
          </h2>
          <div className="bg-bg-card rounded-xl border border-border px-4 divide-y divide-border">
            <SettingRow label="Default Starting Life">
              <Select
                value={String(settings.defaultStartingLife)}
                onChange={(v) =>
                  updateSetting("defaultStartingLife", parseInt(v, 10))
                }
                options={[
                  { value: "20", label: "20" },
                  { value: "40", label: "40" },
                ]}
              />
            </SettingRow>
            <SettingRow label="Default Player Count">
              <Select
                value={String(settings.defaultPlayerCount)}
                onChange={(v) =>
                  updateSetting("defaultPlayerCount", parseInt(v, 10))
                }
                options={[
                  { value: "2", label: "2 Players" },
                  { value: "3", label: "3 Players" },
                  { value: "4", label: "4 Players" },
                ]}
              />
            </SettingRow>
          </div>
        </section>

        {/* Data Section */}
        <section>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
            Data
          </h2>
          <div className="bg-bg-card rounded-xl border border-border px-4 divide-y divide-border">
            <SettingRow
              label="Export Data"
              description="Download all data as JSON"
            >
              <Button variant="secondary" size="sm" onClick={handleExport}>
                Export
              </Button>
            </SettingRow>
            <SettingRow
              label="Import Data"
              description="Restore from a JSON backup"
            >
              <Button variant="secondary" size="sm" onClick={handleImport}>
                Import
              </Button>
            </SettingRow>
            <SettingRow
              label="Clear All Data"
              description="Delete all binders, decks, and cards"
            >
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowClearConfirm(true)}
              >
                Clear
              </Button>
            </SettingRow>
          </div>
        </section>

        {/* About */}
        <section className="pb-8">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
            About
          </h2>
          <div className="bg-bg-card rounded-xl border border-border p-4">
            <p className="text-sm text-text-secondary">
              MTG Houdini is your ultimate Magic: The Gathering companion app.
              Search cards, build decks, manage your collection, and track life
              totals.
            </p>
            <p className="text-sm text-text-muted mt-3">
              Designed by Dan Lopez
            </p>
          </div>
        </section>
      </div>

      {/* Clear Confirm Modal */}
      <Modal
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Clear All Data?"
      >
        <p className="text-sm text-text-secondary mb-4">
          This will permanently delete all your binders, collection cards,
          decks, and life counter history. This action cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowClearConfirm(false)}
          >
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={handleClearAll}>
            Delete Everything
          </Button>
        </div>
      </Modal>
    </div>
  );
}
