import { google } from 'googleapis';

// কনফিগারেশন শীট থেকে ডেটা লোড করা (API Key দিয়ে)
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
            if (name && name.trim()) {
                profiles[name.trim()] = {
                    sales_member: sales?.trim() || null,
                    owner: owner?.trim() || null
                };
            }
        }
        console.log('✅ Profiles loaded:', Object.keys(profiles).length);
    } catch (e) {
        console.warn('⚠️ Profiles sheet error:', e.message);
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
            if (name && name.trim()) {
                teams[name.trim().toLowerCase()] = {
                    leader: leader?.trim() || null,
                    coleader: coleader?.trim() || null
                };
            }
        }
        console.log('✅ Teams loaded:', Object.keys(teams).length);
    } catch (e) {
        console.warn('⚠️ Teams sheet error:', e.message);
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
            const val = rows[i]?.[0];
            if (val && val.trim()) {
                commonMembers.push(val.trim());
            }
        }
        console.log('✅ CommonMembers loaded:', commonMembers.length);
    } catch (e) {
        console.warn('⚠️ CommonMembers sheet error:', e.message);
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
            const val = rows[i]?.[0];
            if (val && val.trim()) {
                fiverrKeywords.push(val.trim().toLowerCase());
            }
        }
        console.log('✅ FiverrKeywords loaded:', fiverrKeywords.length);
    } catch (e) {
        console.warn('⚠️ FiverrKeywords sheet error:', e.message);
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
            const val = rows[i]?.[0];
            if (val && val.trim()) {
                repeatKeywords.push(val.trim().toLowerCase());
            }
        }
        console.log('✅ RepeatKeywords loaded:', repeatKeywords.length);
    } catch (e) {
        console.warn('⚠️ RepeatKeywords sheet error:', e.message);
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
            if (cmd && cmd.trim() && keyword && keyword.trim()) {
                commandKeywords[cmd.trim()] = keyword.trim();
            }
        }
        console.log('✅ CommandKeywords loaded:', Object.keys(commandKeywords).length);
    } catch (e) {
        console.warn('⚠️ CommandKeywords sheet error:', e.message);
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
            const val = rows[i]?.[0];
            if (val && val.trim()) {
                admins.push(val.trim());
            }
        }
        console.log('✅ Admins loaded:', admins.length);
    } catch (e) {
        console.warn('⚠️ Admins sheet error:', e.message);
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
            if (!key) continue;
            if (key === 'bot_username') botUsername = value || botUsername;
            else if (key === 'default_mention_word') defaultMentionWord = value || defaultMentionWord;
            else if (key.startsWith('mention_')) {
                const username = key.replace('mention_', '');
                mentionOverrides[username] = value || '';
            }
        }
        console.log('✅ BotInfo loaded');
    } catch (e) {
        console.warn('⚠️ BotInfo sheet error:', e.message);
    }

    const result = {
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

    console.log('✅ Config loaded from sheet:', {
        profiles: Object.keys(profiles).length,
        teams: Object.keys(teams).length,
        commonMembers: commonMembers.length,
        fiverrKeywords: fiverrKeywords.length,
        repeatKeywords: repeatKeywords.length,
        commandKeywords: Object.keys(commandKeywords).length,
        admins: admins.length,
        botUsername
    });

    return result;
}