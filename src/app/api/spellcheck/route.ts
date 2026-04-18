import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { text, languages } = await req.json();

        if (!text || !languages || languages.length === 0) {
            return NextResponse.json({ errors: [] });
        }

        // Parallelize all language checks using Promise.all
        const results = await Promise.all(languages.map(async (lang: string) => {
            const formData = new URLSearchParams();
            formData.append('text', text);
            formData.append('language', lang);

            const response = await fetch('https://api.languagetool.org/v2/check', {
                method: 'POST',
                body: formData,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });

            if (response.ok) {
                const data = await response.json();
                return data.matches.map((match: any) => ({
                    message: match.message,
                    offset: match.offset,
                    length: match.length,
                    replacements: match.replacements.slice(0, 3).map((r: any) => r.value),
                    language: lang,
                }));
            }
            return [];
        }));

        const allErrors = results.flat();

        // Cross-check: an error is only valid if it overlaps with an error in EVERY selected language
        const validErrors = allErrors.filter(err => {
            return languages.every((lang: string) => {
                if (lang === err.language) return true;
                return allErrors.some(otherErr => 
                    otherErr.language === lang && 
                    err.offset < otherErr.offset + otherErr.length &&
                    otherErr.offset < err.offset + err.length
                );
            });
        });

        // Deduplicate exact matches (same offset and length) to avoid overlapping squiggles
        const finalErrors = [];
        const seen = new Set();
        for (const err of validErrors) {
            const key = `${err.offset}-${err.length}`;
            if (!seen.has(key)) {
                seen.add(key);
                finalErrors.push(err);
            }
        }

        return NextResponse.json({ errors: finalErrors });
    } catch (error) {
        console.error("Spellcheck API Error:", error);
        return NextResponse.json({ errors: [] }, { status: 500 });
    }
}
