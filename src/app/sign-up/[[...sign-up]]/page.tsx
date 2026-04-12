import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg-primary px-4">
      <div className="mb-8 text-center">
        <h1 className="font-display text-4xl font-black text-accent uppercase tracking-wide">
          MTG Houdini
        </h1>
        <p className="text-text-muted text-sm mt-1">Create your account</p>
      </div>
      <SignUp />
    </div>
  );
}
