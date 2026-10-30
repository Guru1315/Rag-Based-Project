"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

/** Theme (dark by default) + toast notifications for the whole app. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      {children}
      <Toaster position="bottom-right" richColors closeButton />
    </ThemeProvider>
  );
}
