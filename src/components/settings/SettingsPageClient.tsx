"use client";

import { useState, useRef, useCallback } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import FeedbackModal from "@/components/ui/FeedbackModal";
import HeroBanner from "@/components/layout/HeroBanner";
import { useSettings } from "@/hooks/useSettings";
import type { UserSettings } from "@/types/settings";
import type { CardCondition } from "@/types/collection";

const GUEST_DATA_PREFIX = "mtg_guest_";

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
      className="bg-bg-card border border-border rounded-xl px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${value ? "bg-accent" : "bg-border"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${value ? "translate-x-6" : "translate-x-1"}`}
      />
    </button>
  );
}

const MORE_ICON = (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

export default function SettingsPageClient() {
  const { user, isSignedIn } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const router = useRouter();
  const { settings, updateSetting, mounted } = useSettings();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  function handleClearGuestData() {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(GUEST_DATA_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
    setShowClearConfirm(false);
    alert("Guest data cleared. Your app preferences have been kept.");
  }

  function handleExportGuestData() {
    const data: Record<string, unknown> = {};
    Object.keys(localStorage)
      .filter((k) => k.startsWith(GUEST_DATA_PREFIX))
      .forEach((k) => {
        try { data[k] = JSON.parse(localStorage.getItem(k) ?? "null"); }
        catch { data[k] = localStorage.getItem(k); }
      });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mtg-houdini-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportGuestData(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as Record<string, unknown>;
        let count = 0;
        for (const [k, v] of Object.entries(data)) {
          if (k.startsWith(GUEST_DATA_PREFIX)) {
            localStorage.setItem(k, JSON.stringify(v));
            count++;
          }
        }
        alert(`Imported ${count} data entries. Refresh to see changes.`);
      } catch {
        alert("Invalid backup file.");
      }
      if (importRef.current) importRef.current.value = "";
    };
    reader.readAsText(file);
  }

  const handleShare = useCallback(async () => {
    const shareData = {
      title: "MTG Houdini",
      text: "Check out MTG Houdini — the ultimate Magic: The Gathering companion app!",
      url: window.location.origin,
    };
    if (navigator.share) {
      await navigator.share(shareData).catch(() => {});
    } else {
      await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
      alert("Link copied to clipboard!");
    }
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex flex-col min-h-screen pb-20">
      <HeroBanner
        title="More"
        subtitle="Settings & account — MTG Houdini v0.2.0"
        accent="#A855F7"
        icon={MORE_ICON}
      />

      <div className="px-4 mt-4 space-y-6">
        {/* Account section */}
        <section>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Account</h2>
          {isSignedIn && user ? (
            <div className="glass-card rounded-2xl border border-border p-4 flex items-center gap-3">
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
                  onClick={() => signOut({ redirectUrl: "/" })}
                  className="text-xs text-text-muted hover:text-banned transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <div className="glass-card rounded-2xl border border-border p-4">
              <p className="text-sm text-text-secondary mb-1">You&apos;re using guest mode</p>
              <p className="text-xs text-text-muted mb-3">Your data is saved on this device only. Sign in to sync across devices.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push("/sign-in")}
                  className="flex-1 py-2 rounded-xl btn-gradient text-sm font-semibold transition-colors"
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

        {/* Display */}
        <section>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Display</h2>
          <div className="glass-card rounded-2xl border border-border px-4 divide-y divide-border">
            <SettingRow label="Default Search View">
              <Select
                value={settings.defaultSearchView}
                onChange={(v) => updateSetting("defaultSearchView", v as UserSettings["defaultSearchView"])}
                options={[{ value: "grid", label: "Grid" }, { value: "list", label: "List" }]}
              />
            </SettingRow>
            <SettingRow label="Card Image Quality">
              <Select
                value={settings.cardImageQuality}
                onChange={(v) => updateSetting("cardImageQuality", v as UserSettings["cardImageQuality"])}
                options={[{ value: "small", label: "Small" }, { value: "normal", label: "Normal" }, { value: "large", label: "Large" }]}
              />
            </SettingRow>
            <SettingRow label="Default Deck Sort">
              <Select
                value={settings.defaultDeckSort}
                onChange={(v) => updateSetting("defaultDeckSort", v as UserSettings["defaultDeckSort"])}
                options={[
                  { value: "mana_value", label: "Mana Value" },
                  { value: "name", label: "Name" },
                  { value: "type", label: "Type" },
                  { value: "color", label: "Color" },
                ]}
              />
            </SettingRow>
          </div>
        </section>

        {/* Pricing */}
        <section>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Pricing</h2>
          <div className="glass-card rounded-2xl border border-border px-4 divide-y divide-border">
            <SettingRow label="Preferred Currency">
              <Select
                value={settings.preferredCurrency}
                onChange={(v) => updateSetting("preferredCurrency", v as UserSettings["preferredCurrency"])}
                options={[{ value: "usd", label: "USD ($)" }, { value: "eur", label: "EUR (€)" }, { value: "tix", label: "TIX" }]}
              />
            </SettingRow>
          </div>
        </section>

        {/* Life Counter */}
        <section>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Life Counter</h2>
          <div className="glass-card rounded-2xl border border-border px-4 divide-y divide-border">
            <SettingRow label="Default Starting Life">
              <Select
                value={String(settings.defaultStartingLife)}
                onChange={(v) => updateSetting("defaultStartingLife", parseInt(v, 10))}
                options={[
                  { value: "20", label: "20 — Standard" },
                  { value: "25", label: "25 — Brawl" },
                  { value: "30", label: "30 — Two-Headed Giant" },
                  { value: "40", label: "40 — Commander" },
                ]}
              />
            </SettingRow>
            <SettingRow label="Default Player Count">
              <Select
                value={String(settings.defaultPlayerCount)}
                onChange={(v) => updateSetting("defaultPlayerCount", parseInt(v, 10))}
                options={[
                  { value: "1", label: "1 Player" },
                  { value: "2", label: "2 Players" },
                  { value: "3", label: "3 Players" },
                  { value: "4", label: "4 Players" },
                ]}
              />
            </SettingRow>
          </div>
        </section>

        {/* Gameplay */}
        <section>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Gameplay</h2>
          <div className="glass-card rounded-2xl border border-border px-4 divide-y divide-border">
            <SettingRow
              label="Show Poison Counters"
              description="Display poison counter tracker on each player panel"
            >
              <Toggle
                value={settings.showPoisonCounters}
                onChange={(v) => updateSetting("showPoisonCounters", v)}
              />
            </SettingRow>
            <SettingRow
              label="Per-Commander Tracking"
              description="Track commander damage from each opponent separately"
            >
              <Toggle
                value={settings.perCommanderTracking}
                onChange={(v) => updateSetting("perCommanderTracking", v)}
              />
            </SettingRow>
          </div>
        </section>

        {/* Collection */}
        <section>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Collection</h2>
          <div className="glass-card rounded-2xl border border-border px-4 divide-y divide-border">
            <SettingRow label="Default Condition" description="Used when adding cards to your collection">
              <Select
                value={settings.defaultCondition}
                onChange={(v) => updateSetting("defaultCondition", v as CardCondition)}
                options={[
                  { value: "near_mint", label: "Near Mint" },
                  { value: "lightly_played", label: "Lightly Played" },
                  { value: "moderately_played", label: "Moderately Played" },
                  { value: "heavily_played", label: "Heavily Played" },
                  { value: "damaged", label: "Damaged" },
                ]}
              />
            </SettingRow>
            <SettingRow label="Default Foil" description="Add cards as foil by default">
              <Toggle
                value={settings.defaultFoil}
                onChange={(v) => updateSetting("defaultFoil", v)}
              />
            </SettingRow>
          </div>
        </section>

        {/* Notifications */}
        <section>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Notifications</h2>
          <div className="glass-card rounded-2xl border border-border px-4 divide-y divide-border">
            <SettingRow
              label="Price Drop Alerts"
              description="Get notified when wishlist cards hit your target price"
            >
              <Toggle
                value={settings.priceDropAlerts}
                onChange={(v) => updateSetting("priceDropAlerts", v)}
              />
            </SettingRow>
          </div>
        </section>

        {/* Data */}
        <section>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Data</h2>
          <div className="glass-card rounded-2xl border border-border px-4 divide-y divide-border">
            {!isSignedIn && (
              <>
                <SettingRow
                  label="Export Guest Data"
                  description="Download a backup of all your locally stored decks, binders, and cards"
                >
                  <Button variant="secondary" size="sm" onClick={handleExportGuestData}>Export</Button>
                </SettingRow>
                <SettingRow
                  label="Import Guest Data"
                  description="Restore from a previously exported backup file"
                >
                  <>
                    <input
                      ref={importRef}
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={handleImportGuestData}
                    />
                    <Button variant="secondary" size="sm" onClick={() => importRef.current?.click()}>Import</Button>
                  </>
                </SettingRow>
                <SettingRow
                  label="Clear Guest Data"
                  description="Deletes all locally stored decks, binders, and cards. Your app preferences are kept."
                >
                  <Button variant="danger" size="sm" onClick={() => setShowClearConfirm(true)}>Clear</Button>
                </SettingRow>
              </>
            )}
          </div>
        </section>

        {/* Share */}
        <section>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Spread the Word</h2>
          <div className="glass-card rounded-2xl border border-border overflow-hidden">
            <button
              onClick={handleShare}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 active:bg-white/10 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">Share with Friends</p>
                <p className="text-xs text-text-muted">Invite others to use MTG Houdini</p>
              </div>
              <svg className="w-4 h-4 text-text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </section>

        {/* What's New */}
        <section>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">What&apos;s New</h2>
          <div className="glass-card rounded-2xl border border-border p-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-text-primary">v0.2.0</p>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Latest</span>
                </div>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  Glass UI redesign with dynamic background art. EDHREC & MTGTop8 deck explorer. Improved life counter with turn timer, commander damage positioning, and manual starter picker. Revamped trading section for mobile. Price drop alert settings.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 opacity-60">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">v0.1.0</p>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  Initial release. Life counter, deck builder, collection manager, card search, wishlist, game log, and trading.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* About */}
        <section className="pb-8">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">About</h2>
          <div className="glass-card rounded-2xl border border-border p-4 space-y-3">
            <p className="text-sm text-text-secondary">MTG Houdini is your ultimate Magic: The Gathering companion app.</p>
            <p className="text-xs text-text-muted">Card data provided by <span className="text-accent">Scryfall</span>. Card names, artwork, and other Magic: The Gathering content are property of Wizards of the Coast.</p>
            <p className="text-sm text-text-muted">Designed by Dan Lopez</p>
            <div className="flex flex-col gap-1.5 pt-1">
              <button
                onClick={() => setShowFeedback(true)}
                className="text-xs text-accent hover:underline text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
              >
                Report a bug / send feedback
              </button>
            </div>
            <p className="text-xs text-text-muted italic border-t border-border pt-3">
              MTG Houdini is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.
            </p>
            <p className="text-xs text-text-muted pt-1 border-t border-border">
              <span className="font-semibold text-text-secondary">v0.2.0</span> — Glass UI, deck explorer, improved life counter & trading.
            </p>
          </div>
        </section>
      </div>

      <FeedbackModal open={showFeedback} onClose={() => setShowFeedback(false)} />

      <Modal open={showClearConfirm} onClose={() => setShowClearConfirm(false)} title="Clear Guest Data?">
        <p className="text-sm text-text-secondary mb-4">
          This will permanently delete all your locally stored decks, binders, and cards. Your app preferences (display settings, currency, etc.) will be kept.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={() => setShowClearConfirm(false)}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={handleClearGuestData}>Clear Data</Button>
        </div>
      </Modal>
    </div>
  );
}
