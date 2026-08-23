/// <reference types="node" />

import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const adminRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: adminRoot,
  build: {
    outDir: "../../dist/admin",
    emptyOutDir: true,
  },
});
