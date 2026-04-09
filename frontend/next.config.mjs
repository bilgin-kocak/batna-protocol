import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Track files outside the frontend dir (../agent) so the bundler includes them
    outputFileTracingRoot: path.join(__dirname, ".."),
    // Don't bundle the CoFHE Node SDK or node-tfhe — they ship WASM files that
    // need to be require()'d at runtime, not webpack'd into a chunk.
    serverComponentsExternalPackages: [
      "@cofhe/sdk",
      "node-tfhe",
      "tfhe",
      "@anthropic-ai/sdk",
    ],
  },
  webpack: (config, { isServer }) => {
    // WASM support for CoFHE SDK (TFHE library)
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Fix for WASM file loading
    config.module.rules.push({
      test: /\.wasm$/,
      type: "asset/resource",
    });

    // Allow imports from ../agent (the BATNA agent SDK lives at repo root)
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@batna/agent": path.join(__dirname, "..", "agent", "index.ts"),
    };

    // The agent module (../agent) imports packages that live only in
    // frontend/node_modules (e.g. @cofhe/sdk, @anthropic-ai/sdk, ethers).
    // Add frontend/node_modules to the resolve search path so webpack can
    // find them when bundling files outside this directory.
    config.resolve.modules = [
      path.join(__dirname, "node_modules"),
      ...(config.resolve.modules || ["node_modules"]),
    ];

    return config;
  },
};

export default nextConfig;
