import { execSync } from "node:child_process";
import { defineConfig, type Plugin } from "vite";

function readCommit(): string {
  const githubSha = process.env.GITHUB_SHA;

  if (githubSha) {
    return githubSha;
  }

  const output = execSync("git rev-parse HEAD");

  return output.toString().trim();
}

function versionFile(): Plugin {
  return {
    name: "version-file",
    generateBundle() {
      const commit = readCommit();
      const source = `${commit}\n`;

      this.emitFile({ type: "asset", fileName: "version.txt", source });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [versionFile()],
});
