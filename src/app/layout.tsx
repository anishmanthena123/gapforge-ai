import type { Metadata } from "next";
import { WorkspaceProvider } from "@/components/workspace-provider";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "GapForge AI — Research, questioned.",
    template: "%s · GapForge AI",
  },
  description:
    "Explore genuine academic literature, challenge research novelty, and map the evidence behind your next idea.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <WorkspaceProvider>{children}</WorkspaceProvider>
      </body>
    </html>
  );
}
