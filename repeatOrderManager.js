import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { isRepeatOrderMessage } from "./configHelper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GROUPS_DB_PATH = path.join(__dirname, "data", "groups.json");

// -------------------------------------------------------
// groups.json e amra protita created group er info store kori:
// { chatId, clientName, profileName, orderId, service, title }
// Eta diye amra pore "repeat client" khuje pai client name dekhe.
// -------------------------------------------------------

function ensureGroupsDb() {
    const dir = path.dirname(GROUPS_DB_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(GROUPS_DB_PATH)) {
        fs.writeFileSync(GROUPS_DB_PATH, JSON.stringify({ groups: [] }, null, 2));
    }
}

function loadGroupsDb() {
    ensureGroupsDb();
    const raw = fs.readFileSync(GROUPS_DB_PATH, "utf-8");
    return JSON.parse(raw);
}

function saveGroupsDb(db) {
    fs.writeFileSync(GROUPS_DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

// notun group record save kora (group create howar pore call hobe)
function recordGroup({ chatId, clientName, profileName, orderId, service, title }) {
    const db = loadGroupsDb();
    db.groups.push({
        chatId,
        clientName,
        profileName,
        orderId,
        service,
        title,
        createdAt: new Date().toISOString()
    });
    saveGroupsDb(db);
}

// client name diye existing group khoja (case-insensitive match)
function findGroupByClientName(clientName) {
    const db = loadGroupsDb();
    const lowerName = clientName.toLowerCase().trim();
    return db.groups.find(g => g.clientName.toLowerCase().trim() === lowerName) || null;
}

// repeat order er notun order id diye purono record update kora
function updateOrderId(chatId, newOrderId) {
    const db = loadGroupsDb();
    const group = db.groups.find(g => g.chatId === chatId);
    if (!group) return null;

    group.previousOrderId = group.orderId;
    group.orderId = newOrderId;
    group.updatedAt = new Date().toISOString();
    saveGroupsDb(db);
    return group;
}

export {
    isRepeatOrderMessage,
    recordGroup,
    findGroupByClientName,
    updateOrderId,
    loadGroupsDb
};
