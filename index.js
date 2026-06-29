import { TelegramClient } from "telegram";
import { loadConfigFromSheet } from "./configFromSheet.js";
import { StringSession } from "telegram/sessions/index.js";
import { NewMessage } from "telegram/events/index.js";
import dotenv from "dotenv";
import { loadUserSession, saveUserSession, getUserClient, loginUser } from "./sessionManager.js";
import { parseGroupInput, createGroupWithMembers } from "./groupManager.js";
import { isRepeatOrderMessage, recordGroup, findGroupByClientName, updateOrderId } from "./repeatOrderManager.js";
import {
    processGenericMessage,
    processFirstUpdate,
    processDocCommand,
    processDeliveryCommand,
    processStopMention
} from "./messageProcessor.js";
import { logAction, logError } from "./logger.js";
import { extractSheetId, getSheetTitle, parseTitle } from "./sheetReader.js";
import { loadConfigFromSheet } from "./configLoader.js";

dotenv.config();

const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const botToken = process.env.BOT_TOKEN;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const CONFIG_SHEET_ID = process.env.CONFIG_SHEET_ID; // নতুন env ভেরিয়েবল

// কনফিগ ক্যাশে
let cachedConfig = null;
let configLastLoaded = 0;
const CONFIG_CACHE_TTL = 300000; // 5 মিনিট

// ---------- কনফিগ লোড ফাংশন ----------
// কনফিগ লোড ফাংশন
async function getConfig() {
    const now = Date.now();
    if (cachedConfig && (now - configLastLoaded) < CONFIG_CACHE_TTL) {
        return cachedConfig;
    }
    if (!CONFIG_SHEET_ID) {
        console.warn('⚠️ CONFIG_SHEET_ID সেট নেই, ডিফল্ট কনফিগ ব্যবহার করা হচ্ছে।');
        return {
            profiles: {},
            teams: {},
            commonMembers: [],
            fiverrKeywords: ['payment', 'paypal', 'whatsapp'],
            repeatKeywords: ['repeat_order', 'repaad'],
            commandKeywords: {
                message: '_msg',
                delivery: '_delivery',
                first_update: '_first_update',
                doc: '_doc',
                stop_mention: '_stop_mention'
            },
            admins: ['5595948603'],
            botUsername: 'your_bot_username_here',
            defaultMentionWord: 'vai',
            mentionOverrides: {}
        };
    }
    try {
        cachedConfig = await loadConfigFromSheet(CONFIG_SHEET_ID, GOOGLE_API_KEY);
        configLastLoaded = now;
        console.log('✅ কনফিগ শীট থেকে লোড করা হয়েছে');
        return cachedConfig;
    } catch (err) {
        console.error('❌ কনফিগ লোড ব্যর্থ:', err.message);
        return cachedConfig || {};
    }
}


// ---------- অ্যাডমিন চেক ----------
async function isAdmin(userId) {
    const config = await getConfig();
    return (config.admins || []).includes(userId);
}

// ---------- ম্যাচিং কমান্ড ----------
async function matchesCommand(text, commandKey) {
    const config = await getConfig();
    const keyword = config.commandKeywords?.[commandKey];
    if (!keyword) return false;
    return text.toLowerCase().includes(keyword.toLowerCase());
}

// ---------- বট ইউজারনেম ----------
async function getBotUsername() {
    const config = await getConfig();
    return config.botUsername || 'your_bot_username_here';
}

// ---------- রিপিট অর্ডার চেক ----------
async function isRepeatOrderMessage(text) {
    const config = await getConfig();
    const keywords = config.repeatKeywords || [];
    const lowerText = text.toLowerCase();
    return keywords.some(kw => lowerText.includes(kw.toLowerCase()));
}

// ---------- ফাইভার কীওয়ার্ড মাস্ক ----------
function maskFiverrKeywords(text) {
    // configHelper-এর maskFiverrKeywords ব্যবহার করবেন
    return text; // আসল ফাংশন configHelper থেকে ইম্পোর্ট করে নিন
}

// ---------- মেইন বট ----------
const pendingSheetLink = new Map();
const pendingRepeatOrder = new Map();

async function startBot() {
    const botClient = new TelegramClient(new StringSession(""), apiId, apiHash, { connectionRetries: 5 });
    await botClient.start({ botAuthToken: botToken });
    console.log("✅ বট ক্লায়েন্ট সংযুক্ত");

    const userClients = new Map();

    async function getUserClientSafe(userId) {
        if (userClients.has(userId)) {
            return userClients.get(userId);
        }
        const client = await getUserClient(userId, apiId, apiHash);
        if (client) {
            userClients.set(userId, client);
            return client;
        }
        return null;
    }

    // ---------- ইভেন্ট হ্যান্ডলার ----------
    botClient.addEventHandler(async (event) => {
        const message = event.message;
        if (!message || !message.text) return;

        const senderId = message.senderId?.toString();
        const text = message.text.trim();
        const chatId = message.chatId?.toString();

        console.log(`📩 মেসেজ: from=${senderId}, chat=${chatId}, text="${text}"`);

        try {
            // ==========================================
            // ১. /start কমান্ড (শুধু অ্যাডমিনরা?)
            // ==========================================
            if (chatId === senderId && text.startsWith("/start")) {
                if (!await isAdmin(senderId)) {
                    await botClient.sendMessage(senderId, { message: "⛔ শুধুমাত্র অ্যাডমিনরা গ্রুপ তৈরি করতে পারেন।" });
                    return;
                }

                let userClient = await getUserClientSafe(senderId);
                if (!userClient) {
                    await botClient.sendMessage(senderId, {
                        message: "🔐 প্রথমবার ব্যবহারের জন্য আপনার টেলিগ্রাম অ্যাকাউন্ট লগইন করুন। দয়া করে আপনার ফোন নম্বর পাঠান (যেমন: +8801712345678):"
                    });
                    // লগইন প্রক্রিয়া এখানে হ্যান্ডেল করা উচিত, কিন্তু সংক্ষেপে রাখছি
                    return;
                }

                const parts = text.split(" ");
                let teamName = null;
                if (parts.length > 1) {
                    teamName = parts[1].trim().toLowerCase();
                }
                const config = await getConfig();
                const teams = config.teams || {};
                if (teamName && !teams[teamName]) {
                    await botClient.sendMessage(senderId, {
                        message: `⚠️ "${teamName}" নামে কোনো টিম কনফিগে নেই। উপলব্ধ টিম: ${Object.keys(teams).join(', ')}`
                    });
                    return;
                }
                pendingSheetLink.set(senderId, { step: 'awaiting_link', team: teamName });
                await botClient.sendMessage(senderId, {
                    message: `📊 Google Sheets-এর পাবলিক লিংক দিন।${teamName ? `\nটিম: ${teamName.toUpperCase()}` : ''}\nশীটের টাইটেল হবে: ClientName || ProfileName || OrderID || Service`
                });
                logAction(senderId, "start_command", teamName || "no_team");
                return;
            }

            // ==========================================
            // ২. শীট লিংক রিসিভ
            // ==========================================
            if (pendingSheetLink.has(senderId) && chatId === senderId) {
                const state = pendingSheetLink.get(senderId);
                if (state.step === 'awaiting_link') {
                    const input = text.trim();
                    const sheetId = extractSheetId(input);
                    if (!sheetId) {
                        await botClient.sendMessage(senderId, { message: "❌ সঠিক শীট লিংক দিন।" });
                        return;
                    }
                    pendingSheetLink.delete(senderId);
                    await botClient.sendMessage(senderId, { message: "⏳ শীটের টাইটেল পড়া হচ্ছে..." });

                    try {
                        if (!GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY সেট করুন।");
                        const title = await getSheetTitle(sheetId, GOOGLE_API_KEY);
                        const parsed = parseTitle(title);
                        if (!parsed) {
                            await botClient.sendMessage(senderId, {
                                message: `⚠️ টাইটেল ফরম্যাট ঠিক নেই: "${title}"\nদরকার: ClientName || ProfileName || OrderID || Service`
                            });
                            return;
                        }

                        const { clientName, profileName, orderId, service } = parsed;
                        const existing = findGroupByClientName(clientName);
                        if (existing) {
                            await botClient.sendMessage(senderId, {
                                message: `ℹ️ "${clientName}" এর জন্য আগে থেকেই গ্রুপ আছে:\n${existing.title}\n\nনতুন অর্ডার হলে repeat_order কীওয়ার্ড ব্যবহার করুন।`
                            });
                            return;
                        }

                        const config = await getConfig();
                        const teams = config.teams || {};
                        let teamMembers = null;
                        if (state.team && teams[state.team]) {
                            teamMembers = {
                                leader: teams[state.team].leader,
                                coleader: teams[state.team].coleader
                            };
                        }

                        await botClient.sendMessage(senderId, { message: "⏳ গ্রুপ তৈরি হচ্ছে..." });

                        const userClient = await getUserClientSafe(senderId);
                        if (!userClient) {
                            await botClient.sendMessage(senderId, { message: "❌ লগইন সমস্যা, আবার চেষ্টা করুন।" });
                            return;
                        }

                        const parsedInput = { clientName, profileName, orderId, service };
                        const report = await createGroupWithMembers(userClient, parsedInput, teamMembers);
                        recordGroup({
                            chatId: report.chatId,
                            clientName,
                            profileName,
                            orderId,
                            service,
                            title: report.title
                        });

                        let resultMsg = `✅ গ্রুপ তৈরি হয়েছে: ${report.title}\n`;
                        if (report.added.length > 0) {
                            resultMsg += `✅ যোগ হয়েছে: ${report.added.map(u => "@" + u).join(", ")}\n`;
                        }
                        if (report.failed.length > 0) {
                            resultMsg += `⚠️ যোগ করা যায়নি:\n`;
                            for (const f of report.failed) {
                                resultMsg += `   - @${f.username} (কারণ: ${f.reason})\n`;
                            }
                        }
                        if (report.warnings.length > 0) {
                            resultMsg += report.warnings.map(w => `⚠️ ${w}`).join("\n");
                        }

                        await botClient.sendMessage(senderId, { message: resultMsg });
                        logAction(senderId, "sheet_group_created", report.title);
                    } catch (err) {
                        await botClient.sendMessage(senderId, { message: `❌ সমস্যা: ${err.message}` });
                        logError("sheet_title_processing", err);
                    }
                    return;
                }
            }

            // ==========================================
            // ৩. গ্রুপের মেসেজ
            // ==========================================
            if (chatId !== senderId) {
                console.log(`📌 গ্রুপ মেসেজ: ${text}`);

                // রিপিট অর্ডার
                if (await isRepeatOrderMessage(text)) {
                    pendingRepeatOrder.set(senderId, { chatId });
                    await botClient.sendMessage(senderId, { message: "🔁 রিপিট অর্ডার শনাক্ত। নতুন অর্ডার আইডি দিন:" });
                    logAction(senderId, "repeat_order_detected", chatId);
                    return;
                }

                if (pendingRepeatOrder.has(senderId)) {
                    const { chatId: pendingChatId } = pendingRepeatOrder.get(senderId);
                    const newOrderId = text;
                    const updated = updateOrderId(pendingChatId, newOrderId);
                    pendingRepeatOrder.delete(senderId);
                    if (updated) {
                        await botClient.sendMessage(senderId, {
                            message: `✅ অর্ডার আইডি আপডেট: ${updated.previousOrderId} → ${updated.orderId}`
                        });
                        logAction(senderId, "order_id_updated", `${updated.previousOrderId} -> ${updated.orderId}`);
                    } else {
                        await botClient.sendMessage(senderId, { message: "⚠️ গ্রুপ রেকর্ড পাওয়া যায়নি।" });
                    }
                    return;
                }

                // গ্রুপ টাইটেল থেকে প্রোফাইল নাম
                let profileName = null;
                try {
                    const chat = await botClient.getEntity(chatId);
                    const title = chat.title || "";
                    const parts = title.split("||").map(p => p.trim());
                    if (parts.length >= 2) {
                        profileName = parts[1];
                    }
                    console.log(`🏷️ গ্রুপ টাইটেল: "${title}" -> প্রোফাইল: "${profileName}"`);
                } catch (err) {
                    console.warn("গ্রুপ টাইটেল পড়া সম্ভব হয়নি:", err.message);
                }

                // কমান্ড পার্সিং
                const lines = text.split("\n");
                let firstLine = lines[0]?.trim() || "";
                let rawMsg = lines.slice(1).join("\n");

                if (lines.length === 1) {
                    const words = firstLine.split(" ");
                    const possibleCmd = words[0];
                    const config = await getConfig();
                    const cmdKeywords = config.commandKeywords || {};
                    const isCmd = Object.values(cmdKeywords).some(kw => possibleCmd.includes(kw));
                    if (isCmd) {
                        firstLine = possibleCmd;
                        rawMsg = words.slice(1).join(" ");
                    }
                }

                console.log(`🔍 firstLine: "${firstLine}", profileName: "${profileName}", rawMsg: "${rawMsg}"`);

                // _stop_mention
                if (await matchesCommand(firstLine, "stop_mention")) {
                    const processed = await processStopMention(rawMsg);
                    await botClient.sendMessage(chatId, { message: processed });
                    logAction(senderId, "stop_mention", chatId);
                    return;
                }

                // _msg
                if (await matchesCommand(firstLine, "message")) {
                    const result = await processGenericMessage(rawMsg, profileName);
                    if (result.message) {
                        await botClient.sendMessage(chatId, { message: result.message });
                    }
                    if (result.mention) {
                        await botClient.sendMessage(chatId, { message: result.mention });
                    }
                    logAction(senderId, "msg_command", profileName);
                    return;
                }

                // _first_update
                if (await matchesCommand(firstLine, "first_update")) {
                    const hasDocument = message.media != null;
                    const processed = await processFirstUpdate(rawMsg, profileName, hasDocument);
                    await botClient.sendMessage(chatId, { message: processed });
                    logAction(senderId, "first_update_command", profileName);
                    return;
                }

                // _doc
                if (await matchesCommand(firstLine, "doc")) {
                    const processed = await processDocCommand(rawMsg, profileName);
                    await botClient.sendMessage(chatId, { message: processed });
                    logAction(senderId, "doc_command", profileName);
                    return;
                }

                // _delivery
                if (await matchesCommand(firstLine, "delivery")) {
                    const hasAttachDoc = text.includes("_attach_doc");
                    const hasInbox = text.includes("_inbox");
                    const processed = await processDeliveryCommand(rawMsg, profileName, hasAttachDoc, hasInbox);
                    await botClient.sendMessage(chatId, { message: processed });
                    logAction(senderId, "delivery_command", profileName);
                    return;
                }

                console.log("ℹ️ কোনো কমান্ড মেলেনি, মেসেজ ইগনোর করা হলো।");
            }
        } catch (err) {
            logError("bot_handler", err);
            await botClient.sendMessage(senderId, { message: `⚠️ ত্রুটি: ${err.message}` });
        }
    }, new NewMessage({}));

    console.log("🚀 বট চালু – কনফিগারেশন শীট থেকে সব ডেটা লোড হবে।");
}

startBot();