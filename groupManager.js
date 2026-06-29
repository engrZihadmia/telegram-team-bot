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

// 🔧 ফাংশন আপডেট – username চেক
async function resolveUserSafe(client, username) {
    // যদি username স্ট্রিং না হয়, তাহলে error রিটার্ন
    if (!username || typeof username !== 'string') {
        return {
            success: false,
            username: String(username || 'unknown'),
            errorCode: 'INVALID_USERNAME',
            errorMessage: 'Username is not a valid string'
        };
    }
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

    // ১. কমন মেম্বার (শুধু ভ্যালিড স্ট্রিং)
    for (const uname of commonMembers) {
        if (uname && typeof uname === 'string' && uname.trim()) {
            usernamesToAdd.push(uname.trim());
        }
    }

    // ২. বট (শুধু ভ্যালিড)
    if (botUsername && typeof botUsername === 'string' && botUsername !== 'your_bot_username_here' && botUsername.trim()) {
        usernamesToAdd.push(botUsername.trim());
    }

    // ৩. টিম লিডার/কো-লিডার
    if (teamMembers) {
        if (teamMembers.leader && typeof teamMembers.leader === 'string' && teamMembers.leader.trim()) {
            usernamesToAdd.push(teamMembers.leader.trim());
        }
        if (teamMembers.coleader && typeof teamMembers.coleader === 'string' && teamMembers.coleader.trim()) {
            usernamesToAdd.push(teamMembers.coleader.trim());
        }
    }

    // ৪. প্রোফাইল থেকে সেলস মেম্বার ও ওনার
    if (mapping) {
        if (mapping.salesMember && typeof mapping.salesMember === 'string' && mapping.salesMember.trim()) {
            usernamesToAdd.push(mapping.salesMember.trim());
        }
        if (mapping.owner && typeof mapping.owner === 'string' && mapping.owner.trim()) {
            usernamesToAdd.push(mapping.owner.trim());
        }
    }

    // ডুপ্লিকেট রিমুভ
    const uniqueUsernames = [...new Set(usernamesToAdd)];

    // রেজলভ
    const resolvedUsers = [];
    for (const uname of uniqueUsernames) {
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

    // গ্রুপ তৈরি
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

    // বটকে অ্যাডমিন বানানো
    if (chatId && botUsername && typeof botUsername === 'string' && botUsername !== 'your_bot_username_here') {
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