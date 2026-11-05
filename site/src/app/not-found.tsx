import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found | mcp-probe",
  description: "This page does not exist.",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-[100dvh] w-full max-w-[72rem] flex-col justify-center px-5 sm:px-8"
    >
      <p className="font-mono text-sm text-fail">FAIL GET this page (404)</p>
      <h1 className="mt-4 font-mono text-3xl font-semibold tracking-tight sm:text-5xl">
        Nothing here
      </h1>
      <p className="mt-4 max-w-[34rem]">The address does not match any page on this site.</p>
      <p className="mt-8">
        <Link href="/" className="btn btn-solid">
          Back to mcp-probe
        </Link>
      </p>
    </main>
  );
}
