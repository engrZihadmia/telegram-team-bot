import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getConfig } from "./configFromSheet.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_SHEET_ID = process.env.CONFIG_SHEET_ID; // নতুন এনভি ভেরিয়েবল

// ক্যাশে
let configCache = null;
let lastLoadTime = 0;
const CACHE_TTL = 60000; // ১ মিনিট

async function loadConfig() {
    if (!CONFIG_SHEET_ID) {
        console.warn('⚠️ CONFIG_SHEET_ID সেট নেই, লোকাল config.json ব্যবহার করা হচ্ছে...');
        return JSON.parse(fs.readFileSync(path.join(__dirname, "config", "config.json"), "utf-8"));
    }
    return await getConfig(CONFIG_SHEET_ID);
}

async function getConfigData(forceReload = false) {
    if (forceReload || !configCache || (Date.now() - lastLoadTime > CACHE_TTL)) {
        configCache = await loadConfig();
        lastLoadTime = Date.now();
        if (configCache) {
            // লোকাল ক্যাশেও সেভ করে রাখি (ফ্যালব্যাকের জন্য)
            try {
                const backupPath = path.join(__dirname, "config", "config_backup.json");
                fs.writeFileSync(backupPath, JSON.stringify(configCache, null, 2));
            } catch (e) {}
        }
    }
    return configCache;
}

// ------------- নতুন ফাংশন -------------
export async function getProfileMapping(profileName) {
    const config = await getConfigData();
    if (!config) return null;
    const profile = config.profiles?.[profileName];
    if (!profile) return null;
    return {
        profileName,
        salesMember: profile.sales_member || null,
        owner: profile.owner || null
    };
}

export async function addOrUpdateProfile(profileName, salesMember, owner = null) {
    // শীটে লেখার ফিচার পরে যোগ করা যাবে
    console.log('⚠️ Profile update via sheet not implemented yet. Please update sheet directly.');
}

export async function getMentionWord(username) {
    const config = await getConfigData();
    if (!config) return 'vai';
    const cleanUsername = username.replace("@", "");
    if (config.mention_overrides?.[cleanUsername]) {
        return config.mention_overrides[cleanUsername];
    }
    return config.default_mention_word || "vai";
}

export function buildMentionLine(username, suffixText) {
    const cleanUsername = username.replace("@", "");
    const word = getMentionWord(cleanUsername);
    return `@${cleanUsername} ${word}, ${suffixText}`;
}

export async function maskFiverrKeywords(text) {
    const config = await getConfigData();
    if (!config) return text;
    let result = text;
    for (const keyword of config.fiverr_keywords || []) {
        const spaced = keyword.split("").join("-");
        const regex = new RegExp(`\\b${keyword}\\b`, "gi");
        result = result.replace(regex, spaced);
    }
    return result;
}

export async function addFiverrKeyword(keyword) {
    console.log('⚠️ Keyword add via sheet not implemented yet. Please update sheet directly.');
}

export async function isRepeatOrderMessage(text) {
    const config = await getConfig();
    const keywords = config.repeatKeywords || [];
    const lowerText = text.toLowerCase();
    return keywords.some(kw => lowerText.includes(kw.toLowerCase()));
}

export async function addRepeatOrderKeyword(keyword) {
    console.log('⚠️ Keyword add via sheet not implemented yet.');
}

export async function matchesCommand(text, commandKey) {
    const config = await getConfigData();
    if (!config) return false;
    const keyword = config.command_keywords?.[commandKey];
    if (!keyword) return false;
    return text.toLowerCase().includes(keyword.toLowerCase());
}

export async function getAdmins() {
    const config = await getConfigData();
    return config?.admins || [];
}

export async function isAdmin(userId) {
    const admins = await getAdmins();
    return admins.includes(userId.toString());
}

export async function getBotUsername() {
    const config = await getConfigData();
    return config?.bot_username || 'your_bot_username_here';
}

export async function getTeams() {
    const config = await getConfigData();
    return config?.teams || {};
}

// লোকাল কনফিগ ফাংশন (Backward compatibility)
export function loadConfigLocal() {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "config", "config.json"), "utf-8"));
}