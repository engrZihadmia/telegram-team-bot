import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_DIR = path.join(__dirname, "data");
const LOG_FILE = path.join(LOG_DIR, "actions.log");

function ensureLogDir() {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
}

function logAction(userId, action, details = "") {
    ensureLogDir();
    const line = `[${new Date().toISOString()}] [ACTION] user=${userId} action=${action} ${details}\n`;
    fs.appendFileSync(LOG_FILE, line, "utf-8");
    console.log(line.trim());
}

function logError(context, err) {
    ensureLogDir();
    const line = `[${new Date().toISOString()}] [ERROR] context=${context} message=${err.message || err}\n`;
    fs.appendFileSync(LOG_FILE, line, "utf-8");
    console.error(line.trim());
}

export { logAction, logError };
