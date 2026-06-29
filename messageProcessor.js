import { maskFiverrKeywords, buildMentionLine, getProfileMapping } from "./configHelper.js";

// ============================================================
// ১. ফ্যালব্যাক রুলস (শুধু গ্রামার, লাইন ব্রেক অপরিবর্তিত)
// ============================================================
function applyGrammarRules(text) {
    const lines = text.split('\n');
    const correctedLines = lines.map(line => {
        if (line.trim() === '') return line; // খালি লাইন অপরিবর্তিত

        let corrected = line;
        const rules = [
            { from: /\bI is\b/gi, to: 'I am' },
            { from: /\bI are\b/gi, to: 'I am' },
            { from: /\bI were\b/gi, to: 'I was' },
            { from: /\byou is\b/gi, to: 'you are' },
            { from: /\byou was\b/gi, to: 'you were' },
            { from: /\bhe are\b/gi, to: 'he is' },
            { from: /\bshe are\b/gi, to: 'she is' },
            { from: /\bit are\b/gi, to: 'it is' },
            { from: /\bwe is\b/gi, to: 'we are' },
            { from: /\bwe was\b/gi, to: 'we were' },
            { from: /\bthey is\b/gi, to: 'they are' },
            { from: /\bthey was\b/gi, to: 'they were' },
            { from: /\bmy is name\b/gi, to: 'my name is' },
            { from: /\bneededed\b/gi, to: 'needed' },
            { from: /\bpayed\b/gi, to: 'paid' },
            { from: /\b(i|me)\b/g, to: (match) => match === 'i' ? 'I' : match },
            { from: /\b(i|me)(?=\s)/g, to: (match) => match === 'i' ? 'I' : match },
        ];
        for (const rule of rules) {
            if (typeof rule.to === 'string') {
                corrected = corrected.replace(rule.from, rule.to);
            } else if (typeof rule.to === 'function') {
                corrected = corrected.replace(rule.from, rule.to);
            }
        }
        // প্রথম অক্ষর বড় করি (যদি বাক্য হয়)
        if (corrected.length > 0 && /^[a-z]/.test(corrected)) {
            corrected = corrected.charAt(0).toUpperCase() + corrected.slice(1);
        }
        return corrected;
    });
    return correctedLines.join('\n');
}

// ============================================================
// ২. Groq API (লাইন-বাই-লাইন, ফরম্যাট অপরিবর্তিত)
// ============================================================
async function fixGrammar(text) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        console.warn('⚠️ GROQ_API_KEY সেট নেই, ফ্যালব্যাক ব্যবহার...');
        return applyGrammarRules(text);
    }

    try {
        const lines = text.split('\n');
        const correctedLines = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // খালি লাইন স্কিপ করি, সেভাবেই রাখি
            if (line.trim() === '') {
                correctedLines.push(line);
                continue;
            }

            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [
                        {
                            role: 'system',
                            content: `You are a grammar and punctuation correction assistant.
                                     Correct the user's text by fixing:
                                     - Capitalization (first letter of sentences, proper nouns)
                                     - Spelling mistakes
                                     - Punctuation (commas, periods, apostrophes)
                                     - Basic grammar (subject-verb agreement, tenses)
                                     
                                     RULES:
                                     1. Do NOT change ANY word unless necessary for grammar/spelling.
                                     2. Do NOT add or remove words unnecessarily.
                                     3. Keep the EXACT meaning, style, and tone.
                                     4. Preserve the line as a single line (do not add line breaks).
                                     5. Reply with ONLY the corrected line, nothing else.
                                     If there are no errors, return the exact same line.`
                        },
                        {
                            role: 'user',
                            content: line
                        }
                    ],
                    temperature: 0.0,
                    max_tokens: 300
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error(`❌ Groq API error on line ${i+1}:`, errorData);
                correctedLines.push(applyGrammarRules(line));
                continue;
            }

            const data = await response.json();
            const corrected = data.choices?.[0]?.message?.content?.trim();

            if (!corrected || corrected === line) {
                correctedLines.push(applyGrammarRules(line));
            } else {
                correctedLines.push(corrected);
            }
        }

        const finalText = correctedLines.join('\n');
        console.log(`✅ Grammar fixed (${lines.length} lines)`);
        return finalText;

    } catch (err) {
        console.error('❌ Groq API error:', err.message);
        return applyGrammarRules(text);
    }
}

// ============================================================
// ৩. মেসেজ প্রসেসিং ফাংশন
// ============================================================
export async function processGenericMessage(rawText, profileName) {
    console.log(`📩 Input: "${rawText}", Profile: "${profileName}"`);

    const grammarFixed = await fixGrammar(rawText);
    const masked = maskFiverrKeywords(grammarFixed);
    console.log(`🔒 Masked: "${masked}"`);

    const mapping = getProfileMapping(profileName);
    let mention = null;
    if (mapping?.salesMember) {
        mention = buildMentionLine(mapping.salesMember, "msg ta send koren");
        console.log(`👤 Mention: "${mention}"`);
    }

    return { mention, message: masked };
}

export async function processFirstUpdate(rawText, profileName, hasDocument) {
    const grammarFixed = await fixGrammar(rawText);
    return maskFiverrKeywords(grammarFixed);
}

export async function processDocCommand(rawText, profileName) {
    const grammarFixed = await fixGrammar(rawText);
    return maskFiverrKeywords(grammarFixed);
}

export async function processDeliveryCommand(rawText, profileName, hasAttachDoc, hasInbox) {
    const grammarFixed = await fixGrammar(rawText);
    return maskFiverrKeywords(grammarFixed);
}

export async function processStopMention(rawText) {
    const grammarFixed = await fixGrammar(rawText);
    return maskFiverrKeywords(grammarFixed);
}