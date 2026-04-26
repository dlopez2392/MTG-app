import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { THEME } from "@/lib/constants";

const clerkAppearance = {
  variables: {
    colorBackground: THEME.bgSecondary,
    colorInputBackground: THEME.bgPrimary,
    colorPrimary: THEME.accent,
    colorText: THEME.textPrimary,
    colorTextSecondary: THEME.textSecondary,
    colorInputText: THEME.textPrimary,
    colorNeutral: THEME.textPrimary,
    colorDanger: "#EF4444",
    borderRadius: "0.75rem",
    fontFamily: "inherit",
  },
  elements: {
    card: {
      background: THEME.bgSecondary,
      border: `1px solid ${THEME.border}`,
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    },
    headerTitle: { color: THEME.textPrimary, fontWeight: "700" },
    headerSubtitle: { color: THEME.textSecondary },
    formFieldLabel: { color: THEME.textSecondary },
    formFieldInput: {
      background: THEME.bgPrimary,
      border: `1px solid ${THEME.border}`,
      color: THEME.textPrimary,
    },
    formFieldInput__focus: { borderColor: THEME.accent },
    formButtonPrimary: {
      background: THEME.accent,
      color: "#fff",
      fontWeight: "600",
      "&:hover": { background: THEME.accentDark },
    },
    footerActionLink: { color: THEME.accent },
    identityPreviewText: { color: THEME.textPrimary },
    identityPreviewEditButton: { color: THEME.accent },
    dividerLine: { background: THEME.border },
    dividerText: { color: THEME.textMuted },
    socialButtonsBlockButton: {
      background: THEME.bgCard,
      border: `1px solid ${THEME.border}`,
      color: THEME.textPrimary,
    },
    socialButtonsBlockButtonText: { color: THEME.textPrimary },
    alternativeMethodsBlockButton: {
      background: THEME.bgCard,
      border: `1px solid ${THEME.border}`,
      color: THEME.textPrimary,
    },
    navbar: { display: "none" },
    rootBox: { width: "100%" },
  },
};

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg-primary px-4 gap-6">
      <div className="text-center">
        <h1 className="font-display text-4xl font-black text-accent uppercase tracking-wide">
          MTG Houdini
        </h1>
        <p className="text-text-muted text-sm mt-1">Your MTG companion</p>
      </div>
      <SignIn appearance={clerkAppearance} />
      <Link
        href="/"
        className="text-sm text-text-muted hover:text-text-secondary transition-colors"
      >
        Continue as guest →
      </Link>
    </div>
  );
}
