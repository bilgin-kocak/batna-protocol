"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { config } from "@/config/wagmi";
import "@rainbow-me/rainbowkit/styles.css";
import dynamic from "next/dynamic";

const queryClient = new QueryClient();

const batnaTheme = darkTheme({
  accentColor: "#c9a227",
  accentColorForeground: "#0c0c0f",
  borderRadius: "small",
  fontStack: "system",
});

// Dynamic import CofheProvider to avoid SSR window issues
const CofheWrapper = dynamic(
  () => import("./CofheWrapper").then((mod) => mod.CofheWrapper),
  { ssr: false }
);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={batnaTheme}>
          <CofheWrapper>{children}</CofheWrapper>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
