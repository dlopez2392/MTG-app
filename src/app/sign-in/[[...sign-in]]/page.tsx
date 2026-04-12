import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

const clerkAppearance = {
  variables: {
    colorBackground: "#1A1A22",
    colorInputBackground: "#0D0D10",
    colorPrimary: "#ED9A57",
    colorText: "#F0F0EE",
    colorTextSecondary: "#9090A0",
    colorInputText: "#F0F0EE",
    colorNeutral: "#F0F0EE",
    colorDanger: "#EF4444",
    borderRadius: "0.75rem",
    fontFamily: "inherit",
  },
  elements: {
    card: {
      background: "#1A1A22",
      border: "1px solid #25252F",
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    },
    headerTitle: { color: "#F0F0EE", fontWeight: "700" },
    headerSubtitle: { color: "#9090A0" },
    formFieldLabel: { color: "#9090A0" },
    formFieldInput: {
      background: "#0D0D10",
      border: "1px solid #25252F",
      color: "#F0F0EE",
    },
    formFieldInput__focus: { borderColor: "#ED9A57" },
    formButtonPrimary: {
      background: "#ED9A57",
      color: "#000",
      fontWeight: "600",
      "&:hover": { background: "#D4823F" },
    },
    footerActionLink: { color: "#ED9A57" },
    identityPreviewText: { color: "#F0F0EE" },
    identityPreviewEditButton: { color: "#ED9A57" },
    dividerLine: { background: "#25252F" },
    dividerText: { color: "#56566A" },
    socialButtonsBlockButton: {
      background: "#141419",
      border: "1px solid #25252F",
      color: "#F0F0EE",
    },
    socialButtonsBlockButtonText: { color: "#F0F0EE" },
    alternativeMethodsBlockButton: {
      background: "#141419",
      border: "1px solid #25252F",
      color: "#F0F0EE",
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
