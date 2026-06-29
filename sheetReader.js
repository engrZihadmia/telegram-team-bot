import { google } from 'googleapis';

export async function getSheetTitle(spreadsheetId, apiKey) {
    const sheets = google.sheets({ version: 'v4', auth: apiKey });
    const res = await sheets.spreadsheets.get({ spreadsheetId });
    return res.data.properties.title;
}

export function extractSheetId(input) {
    const match = input.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) return match[1];
    if (/^[a-zA-Z0-9-_]+$/.test(input.trim())) return input.trim();
    return null;
}

// টাইটেল থেকে অংশগুলো আলাদা করা
export function parseTitle(title) {
    const parts = title.split('||').map(p => p.trim());
    if (parts.length !== 4) return null;
    return {
        clientName: parts[0],
        profileName: parts[1],
        orderId: parts[2],
        service: parts[3]
    };
}