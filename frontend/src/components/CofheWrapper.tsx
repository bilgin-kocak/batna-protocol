"use client";

import { CofheProvider, createCofheConfig } from "@cofhe/react";
import { arbSepolia } from "@cofhe/sdk/chains";

const cofheConfig = createCofheConfig({
  supportedChains: [arbSepolia],
});

export function CofheWrapper({ children }: { children: React.ReactNode }) {
  return <CofheProvider config={cofheConfig}>{children}</CofheProvider>;
}
