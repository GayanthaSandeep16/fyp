// File: utils/cleanup.js
import fs from "fs/promises";
import path from "path";

export const cleanupTempDir = async () => {
  const tempDir = path.join(__dirname, "../temp");
  try {
    const files = await fs.readdir(tempDir);
    for (const file of files) {
      await fs.unlink(path.join(tempDir, file));
      console.log(`Deleted old temp file: ${file}`);
    }
  } catch (err) {
    console.error("Failed to clean up temp directory:", err);
  }
};

