import { useEffect, useState, useRef } from "react";

export default function useTypingTextAnimation(phrases: string[], delayDuration: number = 2000) {
    const [phraseIndex, setPhraseIndex] = useState(0);
    const [displayText, setDisplayText] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const phrasesRef = useRef(phrases);
    phrasesRef.current = phrases;

    useEffect(() => {
        let timer: any;
        const currentPhrases = phrasesRef.current;
        if (currentPhrases.length === 0) return;

        const currentPhrase = currentPhrases[phraseIndex % currentPhrases.length];

        if (!isDeleting && displayText === currentPhrase) {
            // Pause at the end of typing
            timer = setTimeout(() => setIsDeleting(true), delayDuration);
        } else if (isDeleting && displayText.length <= 1) {
            // Finished deleting down to first char, move to next phrase
            setIsDeleting(false);
            const nextIndex = (phraseIndex + 1) % currentPhrases.length;
            setPhraseIndex(nextIndex);
            setDisplayText(currentPhrases[nextIndex].substring(0, 1));
        } else {
            // Step typing or deleting
            timer = setTimeout(() => {
                const nextText = isDeleting
                    ? currentPhrase.substring(0, Math.max(1, displayText.length - 1))
                    : currentPhrase.substring(0, displayText.length + 1);
                
                // If we're starting from empty (init), ensure we get at least 1 char
                setDisplayText(nextText || currentPhrase.substring(0, 1));
            }, isDeleting ? 20 : 30);
        }

        return () => clearTimeout(timer);
    }, [displayText, isDeleting, phraseIndex, delayDuration]);

    return displayText;
}