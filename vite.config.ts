/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "node",
    // Extending rather than replacing Vitest's defaults so `.cache`, `.idea`,
    // etc. stay excluded. `vendor/**` keeps the engine submodule's embedded
    // scaffold tests out of our run.
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/vendor/**",
    ],
  },
});
