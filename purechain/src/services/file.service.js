import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

// __dirname is not available in ES Modules, so we define it manually
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const saveFileToTemp = async (file) => {
  return new Promise((resolve, reject) => {
    const tempDir = path.join(__dirname, "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir); // Create temp directory if it doesn't exist
    }

    const filePath = path.join(tempDir, file.name);
    file.mv(filePath, (err) => {
      if (err) {
        return reject(err);
      }
      resolve(filePath); // Resolve with the file path
    });
  });
};

export const validateData = (filePath) => {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn("python", [
      "./dataValidator/dataValidator.py",
      filePath,
    ]);

    let result = "";
    pythonProcess.stdout.on("data", (data) => {
      result += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      reject({ error: `Validator error: ${data.toString()}` });
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        reject({ error: `Validator exited with code ${code}` });
        return;
      }

      try {
        resolve(JSON.parse(result));
      } catch (e) {
        reject({ error: "Failed to parse validator output" });
      }
    });
  });
};

export const generateUniqueId = (name, organization, id) => {
  return `${name}-${organization}-${id}`;
};
