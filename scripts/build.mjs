import { copyFile, mkdir, rm } from "node:fs/promises";

const outputDirectory = new URL("../public/", import.meta.url);
const files = ["index.html", "privacy.html", "_headers"];

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

await Promise.all(
  files.map((file) =>
    copyFile(new URL(`../${file}`, import.meta.url), new URL(file, outputDirectory)),
  ),
);
