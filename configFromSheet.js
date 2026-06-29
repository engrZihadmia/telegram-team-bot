import { google } from 'googleapis';

// কনফিগারেশন শীট থেকে ডেটা লোড করা
export async function loadConfigFromSheet(sheetId, apiKey) {
    const sheets = google.sheets({ version: 'v4', auth: apiKey });
    
    // ১. প্রোফাইল লোড (Sheet: Profiles)
    const profiles = {};
    try {
        const profileRes = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: 'Profiles!A:C' // Columns: ProfileName, SalesMember, Owner
        });
        const rows = profileRes.data.values || [];
        for (let i = 1; i < rows.length; i++) { // প্রথম সারি হেডার
            const [name, sales, owner] = rows[i];
            if (name) {
                profiles[name.trim()] = {
                    sales_member: sales?.trim() || null,
                    owner: owner?.trim() || null
                };
            }
        }
    } catch (e) {
        console.warn('⚠️ Profiles sheet not found:', e.message);
    }

    // ২. টিম লোড (Sheet: Teams)
    const teams = {};
    try {
        const teamRes = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: 'Teams!A:C' // Columns: TeamName, Leader, CoLeader
        });
        const rows = teamRes.data.values || [];
        for (let i = 1; i < rows.length; i++) {
            const [name, leader, coleader] = rows[i];
            if (name) {
                teams[name.trim().toLowerCase()] = {
                    leader: leader?.trim() || null,
                    coleader: coleader?.trim() || null
                };
            }
        }
    } catch (e) {
        console.warn('⚠️ Teams sheet not found:', e.message);
    }

    // ৩. কমন মেম্বার লোড (Sheet: CommonMembers)
    let commonMembers = [];
    try {
        const commonRes = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: 'CommonMembers!A:A' // Column A: Usernames
        });
        const rows = commonRes.data.values || [];
        for (let i = 1; i < rows.length; i++) {
            if (rows[i]?.[0]) {
                commonMembers.push(rows[i][0].trim());
            }
        }
    } catch (e) {
        console.warn('⚠️ CommonMembers sheet not found:', e.message);
    }

    // ৪. ফাইভার কীওয়ার্ড লোড (Sheet: FiverrKeywords)
    let fiverrKeywords = [];
    try {
        const keywordRes = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: 'FiverrKeywords!A:A' // Column A: Keywords
        });
        const rows = keywordRes.data.values || [];
        for (let i = 1; i < rows.length; i++) {
            if (rows[i]?.[0]) {
                fiverrKeywords.push(rows[i][0].trim().toLowerCase());
            }
        }
    } catch (e) {
        console.warn('⚠️ FiverrKeywords sheet not found:', e.message);
    }

    // ৫. রিপিট অর্ডার কীওয়ার্ড লোড (Sheet: RepeatKeywords)
    let repeatKeywords = [];
    try {
        const repeatRes = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: 'RepeatKeywords!A:A' // Column A: Keywords
        });
        const rows = repeatRes.data.values || [];
        for (let i = 1; i < rows.length; i++) {
            if (rows[i]?.[0]) {
                repeatKeywords.push(rows[i][0].trim().toLowerCase());
            }
        }
    } catch (e) {
        console.warn('⚠️ RepeatKeywords sheet not found:', e.message);
    }

    // ৬. কমান্ড কীওয়ার্ড লোড (Sheet: CommandKeywords)
    const commandKeywords = {};
    try {
        const cmdRes = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: 'CommandKeywords!A:B' // Columns: Command, Keyword
        });
        const rows = cmdRes.data.values || [];
        for (let i = 1; i < rows.length; i++) {
            const [cmd, keyword] = rows[i];
            if (cmd && keyword) {
                commandKeywords[cmd.trim()] = keyword.trim();
            }
        }
    } catch (e) {
        console.warn('⚠️ CommandKeywords sheet not found:', e.message);
    }

    // ৭. অ্যাডমিন আইডি লোড (Sheet: Admins)
    let admins = [];
    try {
        const adminRes = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: 'Admins!A:A' // Column A: User IDs
        });
        const rows = adminRes.data.values || [];
        for (let i = 1; i < rows.length; i++) {
            if (rows[i]?.[0]) {
                admins.push(rows[i][0].trim());
            }
        }
    } catch (e) {
        console.warn('⚠️ Admins sheet not found:', e.message);
    }

    // ৮. বট ইউজারনেম (Sheet: BotInfo)
    let botUsername = 'your_bot_username_here';
    let defaultMentionWord = 'vai';
    const mentionOverrides = {};
    try {
        const botRes = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: 'BotInfo!A:B' // Columns: Key, Value
        });
        const rows = botRes.data.values || [];
        for (const row of rows) {
            const key = row[0]?.trim();
            const value = row[1]?.trim();
            if (key === 'bot_username') botUsername = value;
            else if (key === 'default_mention_word') defaultMentionWord = value;
            else if (key.startsWith('mention_')) {
                const username = key.replace('mention_', '');
                mentionOverrides[username] = value;
            }
        }
    } catch (e) {
        console.warn('⚠️ BotInfo sheet not found:', e.message);
    }

    return {
        profiles,
        teams,
        commonMembers,
        fiverrKeywords,
        repeatKeywords,
        commandKeywords,
        admins,
        botUsername,
        defaultMentionWord,
        mentionOverrides
    };
}