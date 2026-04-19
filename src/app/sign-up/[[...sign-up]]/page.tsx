import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

const clerkAppearance = {
  variables: {
    colorBackground: "#111520",
    colorInputBackground: "#0B0E14",
    colorPrimary: "#ED9A57",
    colorText: "#E8EAF0",
    colorTextSecondary: "#8B90A0",
    colorInputText: "#E8EAF0",
    colorNeutral: "#E8EAF0",
    colorDanger: "#EF4444",
    borderRadius: "0.75rem",
    fontFamily: "inherit",
  },
  elements: {
    card: {
      background: "#111520",
      border: "1px solid #1E2433",
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    },
    headerTitle: { color: "#E8EAF0", fontWeight: "700" },
    headerSubtitle: { color: "#8B90A0" },
    formFieldLabel: { color: "#8B90A0" },
    formFieldInput: {
      background: "#0B0E14",
      border: "1px solid #1E2433",
      color: "#E8EAF0",
    },
    formButtonPrimary: {
      background: "#ED9A57",
      color: "#fff",
      fontWeight: "600",
      "&:hover": { background: "#D4823F" },
    },
    footerActionLink: { color: "#ED9A57" },
    identityPreviewText: { color: "#E8EAF0" },
    identityPreviewEditButton: { color: "#ED9A57" },
    dividerLine: { background: "#1E2433" },
    dividerText: { color: "#4E5364" },
    socialButtonsBlockButton: {
      background: "#161B27",
      border: "1px solid #1E2433",
      color: "#E8EAF0",
    },
    socialButtonsBlockButtonText: { color: "#E8EAF0" },
    alternativeMethodsBlockButton: {
      background: "#161B27",
      border: "1px solid #1E2433",
      color: "#E8EAF0",
    },
    navbar: { display: "none" },
    rootBox: { width: "100%" },
  },
};

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg-primary px-4 gap-6">
      <div className="text-center">
        <h1 className="font-display text-4xl font-black text-accent uppercase tracking-wide">
          MTG Houdini
        </h1>
        <p className="text-text-muted text-sm mt-1">Create your account</p>
      </div>
      <SignUp appearance={clerkAppearance} />
      <Link
        href="/"
        className="text-sm text-text-muted hover:text-text-secondary transition-colors"
      >
        Continue as guest →
      </Link>
    </div>
  );
}
