import { Api } from "telegram";
import { getProfileMapping, getBotUsername, loadConfig } from "./configHelper.js";

function parseGroupInput(text) {
    const parts = text.split("||").map(p => p.trim());
    if (parts.length !== 4) return null;
    const [clientName, profileName, orderId, service] = parts;
    return { clientName, profileName, orderId, service };
}

function buildGroupTitle({ clientName, profileName, orderId, service }) {
    return `${clientName} || ${profileName} || ${orderId} || ${service}`;
}

async function resolveUserSafe(client, username) {
    const cleanUsername = username.replace("@", "");
    try {
        const entity = await client.getEntity(cleanUsername);
        return { success: true, entity, username: cleanUsername };
    } catch (err) {
        return {
            success: false,
            username: cleanUsername,
            errorCode: err.errorMessage || err.code || "UNKNOWN",
            errorMessage: err.message || String(err)
        };
    }
}

async function createGroupWithMembers(commandingClient, parsedInput, teamMembers = null) {
    const { clientName, profileName, orderId, service } = parsedInput;
    const title = buildGroupTitle(parsedInput);
    const botUsername = getBotUsername();
    const config = loadConfig();
    const commonMembers = config.common_members || [];

    const mapping = getProfileMapping(profileName);

    const report = {
        title,
        chatId: null,
        added: [],
        failed: [],
        warnings: []
    };

    if (!mapping) {
        report.warnings.push(`Profile "${profileName}" config.json e paoa jay nai. Sales member/owner add kora possible na.`);
    }

    const usernamesToAdd = [];

    // common members
    for (const uname of commonMembers) {
        if (uname && uname.trim()) usernamesToAdd.push(uname.trim());
    }

    // bot
    if (botUsername && botUsername !== "your_bot_username_here") {
        usernamesToAdd.push(botUsername);
    }

    // team leader/coleader
    if (teamMembers) {
        if (teamMembers.leader) usernamesToAdd.push(teamMembers.leader);
        if (teamMembers.coleader) usernamesToAdd.push(teamMembers.coleader);
    }

    // profile sales & owner
    if (mapping && mapping.salesMember) usernamesToAdd.push(mapping.salesMember);
    if (mapping && mapping.owner) usernamesToAdd.push(mapping.owner);

    // resolve all
    const resolvedUsers = [];
    for (const uname of usernamesToAdd) {
        const result = await resolveUserSafe(commandingClient, uname);
        if (result.success) {
            resolvedUsers.push(result);
        } else {
            report.failed.push({
                username: uname,
                stage: "resolve",
                reason: result.errorCode
            });
        }
    }

    if (resolvedUsers.length === 0) {
        throw new Error("কোনো ইউজার রেজলভ করা যায়নি – গ্রুপ তৈরি বন্ধ।");
    }

    // create group
    let createResult;
    try {
        createResult = await commandingClient.invoke(
            new Api.messages.CreateChat({
                users: resolvedUsers.map(r => r.entity),
                title: title
            })
        );
    } catch (err) {
        if (err.errorMessage === "USER_PRIVACY_RESTRICTED" || /PRIVACY/i.test(err.message || "")) {
            throw new Error("কোনো ইউজারের প্রাইভেসি সেটিং গ্রুপে অ্যাড হতে বাধা দিচ্ছে।");
        }
        throw new Error(`Group create error: ${err.errorMessage || err.message}`);
    }

    const chatId = createResult.chats && createResult.chats.length > 0
        ? createResult.chats[0].id
        : null;

    report.chatId = chatId;
    report.added = resolvedUsers.map(r => r.username);

    // ---------- বটকে অ্যাডমিন বানানো ----------
    if (chatId && botUsername && botUsername !== "your_bot_username_here") {
        const botResult = await resolveUserSafe(commandingClient, botUsername);
        if (botResult.success) {
            try {
                await commandingClient.invoke(new Api.messages.EditChatAdmin({
                    chatId: chatId,
                    userId: botResult.entity,
                    isAdmin: true
                }));
                report.warnings.push(`✅ বট @${botUsername} কে অ্যাডমিন বানানো হয়েছে।`);
            } catch (err) {
                report.warnings.push(`⚠️ বটকে অ্যাডমিন বানাতে সমস্যা: ${err.message}`);
            }
        } else {
            report.warnings.push(`⚠️ বটের ইউজারনেম রেজলভ করা যায়নি, অ্যাডমিন বানানো সম্ভব হয়নি।`);
        }
    }

    return report;
}

export {
    parseGroupInput,
    buildGroupTitle,
    resolveUserSafe,
    createGroupWithMembers
};