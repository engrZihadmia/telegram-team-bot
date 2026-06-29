import { google } from 'googleapis';
import { StringSession } from 'telegram/sessions/index.js';
import { TelegramClient } from 'telegram';
import input from 'input';

const SESSION_SHEET_ID = process.env.SESSION_SHEET_ID;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// ---------- Google Sheets-এ সেশন রিড ----------
async function loadSessionFromSheet(userId) {
    try {
        const sheets = google.sheets({ version: 'v4', auth: GOOGLE_API_KEY });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SESSION_SHEET_ID,
            range: 'Sheet1!A:D'
        });
        const rows = response.data.values || [];
        for (let i = 1; i < rows.length; i++) {
            const [storedUserId, sessionString] = rows[i];
            if (storedUserId === userId && sessionString) {
                return new StringSession(sessionString);
            }
        }
        return null;
    } catch (err) {
        console.error('❌ Session load error:', err.message);
        return null;
    }
}

// ---------- Google Sheets-এ সেশন সেভ ----------
async function saveSessionToSheet(userId, sessionString) {
    try {
        const sheets = google.sheets({ version: 'v4', auth: GOOGLE_API_KEY });
        const existing = await sheets.spreadsheets.values.get({
            spreadsheetId: SESSION_SHEET_ID,
            range: 'Sheet1!A:A'
        });
        const rows = existing.data.values || [];
        let rowIndex = -1;
        for (let i = 1; i < rows.length; i++) {
            if (rows[i]?.[0] === userId) {
                rowIndex = i + 1;
                break;
            }
        }
        const now = new Date().toISOString();
        if (rowIndex > 0) {
            await sheets.spreadsheets.values.update({
                spreadsheetId: SESSION_SHEET_ID,
                range: `Sheet1!B${rowIndex}:D${rowIndex}`,
                valueInputOption: 'RAW',
                requestBody: {
                    values: [[sessionString, now, now]]
                }
            });
        } else {
            const newRow = [[userId, sessionString, now, now]];
            await sheets.spreadsheets.values.append({
                spreadsheetId: SESSION_SHEET_ID,
                range: 'Sheet1!A:D',
                valueInputOption: 'RAW',
                requestBody: { values: newRow }
            });
        }
        console.log('✅ Session saved to Google Sheets');
    } catch (err) {
        console.error('❌ Session save error:', err.message);
    }
}

// ---------- ইউজার ক্লায়েন্ট তৈরি ----------
export async function getUserClient(userId, apiId, apiHash) {
    const session = await loadSessionFromSheet(userId);
    if (!session) return null;
    const client = new TelegramClient(session, apiId, apiHash, { connectionRetries: 5 });
    await client.connect();
    return client;
}

// ---------- নতুন ইউজার লগইন ----------
export async function loginUser(userId, apiId, apiHash) {
    const session = new StringSession('');
    const client = new TelegramClient(session, apiId, apiHash, { connectionRetries: 5 });

    console.log(`📱 User ${userId} login starting...`);
    
    await client.start({
        phoneNumber: async () => {
            console.log('📞 Enter phone number:');
            return await input.text('Phone: ');
        },
        password: async () => {
            console.log('🔑 Enter 2FA password:');
            return await input.text('Password: ');
        },
        phoneCode: async () => {
            console.log('📨 Enter the code sent to Telegram:');
            return await input.text('Code: ');
        },
        onError: (err) => console.error('Login error:', err)
    });

    console.log('✅ Login successful!');
    const sessionString = client.session.save();
    await saveSessionToSheet(userId, sessionString);
    
    return client;
}

export { loadSessionFromSheet, saveSessionToSheet };