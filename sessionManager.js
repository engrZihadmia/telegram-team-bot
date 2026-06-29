import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import input from 'input';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SESSIONS_DIR = path.join(__dirname, 'sessions');

// সেশন ফোল্ডার তৈরি
if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// ইউজারের সেশন লোড করা
export function loadUserSession(userId) {
    const sessionPath = path.join(SESSIONS_DIR, `${userId}.session`);
    if (fs.existsSync(sessionPath)) {
        const sessionString = fs.readFileSync(sessionPath, 'utf-8').trim();
        return new StringSession(sessionString);
    }
    return null;
}

// ইউজারের সেশন সেভ করা
export function saveUserSession(userId, sessionString) {
    const sessionPath = path.join(SESSIONS_DIR, `${userId}.session`);
    fs.writeFileSync(sessionPath, sessionString, 'utf-8');
}

// ইউজারের জন্য ক্লায়েন্ট তৈরি করা (সেশন থাকলে)
export async function getUserClient(userId, apiId, apiHash) {
    const session = loadUserSession(userId);
    if (!session) {
        return null;
    }
    const client = new TelegramClient(session, apiId, apiHash, {
        connectionRetries: 5
    });
    await client.connect();
    return client;
}

// নতুন ইউজার লগইন করানো (প্রথমবার বা সেশন নেই)
export async function loginUser(userId, apiId, apiHash) {
    const session = new StringSession('');
    const client = new TelegramClient(session, apiId, apiHash, {
        connectionRetries: 5
    });

    console.log(`📱 User ${userId} login starting...`);
    
    await client.start({
        phoneNumber: async () => {
            console.log('📞 Enter your phone number (with country code, e.g., +880...):');
            return await input.text('Phone: ');
        },
        password: async () => {
            console.log('🔑 Enter your 2FA password (if any, else press Enter):');
            return await input.text('Password: ');
        },
        phoneCode: async () => {
            console.log('📨 Enter the code sent to your Telegram:');
            return await input.text('Code: ');
        },
        onError: (err) => console.error('Login error:', err)
    });

    console.log('✅ Login successful!');
    
    // সেশন সেভ করা
    const sessionString = client.session.save();
    saveUserSession(userId, sessionString);
    
    return client;
}