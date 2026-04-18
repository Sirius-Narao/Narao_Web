import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const SpellcheckPluginKey = new PluginKey('spellcheck');

export interface SpellcheckOptions {
    getLanguages: () => string[];
}

export const SpellcheckExtension = Extension.create<SpellcheckOptions>({
    name: 'spellcheck',

    addOptions() {
        return {
            getLanguages: () => ['en-US'],
        };
    },

    addProseMirrorPlugins() {
        const { getLanguages } = this.options;
        let debounceTimer: NodeJS.Timeout;

        return [
            new Plugin({
                key: SpellcheckPluginKey,
                state: {
                    init: () => DecorationSet.empty,
                    apply(tr, oldSet) {
                        // Map existing decorations as the user types
                        let set = oldSet.map(tr.mapping, tr.doc);
                        
                        // If we attached new errors to the transaction, render them
                        const newErrors = tr.getMeta(SpellcheckPluginKey);
                        if (newErrors) {
                            const decos = newErrors.map((err: any) => {
                                return Decoration.inline(err.from, err.to, {
                                    class: 'spellcheck-error',
                                    'data-message': err.message,
                                    'data-replacements': JSON.stringify(err.replacements),
                                    'data-from': err.from.toString(),
                                    'data-to': err.to.toString(),
                                });
                            });
                            set = DecorationSet.create(tr.doc, decos);
                        }
                        return set;
                    },
                },
                props: {
                    decorations(state) {
                        return this.getState(state);
                    },
                    attributes: {
                        spellcheck: 'false', // Disable native browser spellcheck
                    }
                },
                view(editorView) {
                    return {
                        update: (view, prevState) => {
                            // Only trigger fetch if document actually changed
                            if (prevState.doc.eq(view.state.doc)) return;

                            clearTimeout(debounceTimer);
                            debounceTimer = setTimeout(async () => {
                                let extractText = '';
                                const textToPm: number[] = [];

                                // 1. Extract text and build offset mapping
                                view.state.doc.descendants((node, pos) => {
                                    if (node.isText) {
                                        const isMathOrCode = node.marks.some((m: any) => m.type.name === 'math' || m.type.name === 'code');
                                        const nodeText = node.text || '';
                                        
                                        for (let i = 0; i < nodeText.length; i++) {
                                            if (isMathOrCode) {
                                                if (extractText.length > 0 && !/\s/.test(extractText[extractText.length - 1])) {
                                                    extractText += ' ';
                                                    textToPm.push(pos + i);
                                                }
                                            } else {
                                                const char = nodeText[i];
                                                if (/\s/.test(char) && extractText.length > 0 && /\s/.test(extractText[extractText.length - 1])) {
                                                    // Skip duplicate whitespace to avoid LanguageTool 'repeated space' errors
                                                } else {
                                                    extractText += char;
                                                    textToPm.push(pos + i);
                                                }
                                            }
                                        }
                                    } else if (node.type.name === 'mathAwareCodeBlock' || node.type.name === 'codeBlock') {
                                        while (extractText.length > 0 && !extractText.endsWith('\n\n')) {
                                            extractText += '\n';
                                            textToPm.push(pos);
                                        }
                                        return false; // Skip entire code block
                                    } else if (node.isBlock && node.type.name !== 'doc') {
                                        // Ensure block boundaries insert double newlines so LanguageTool treats them as separate paragraphs
                                        while (extractText.length > 0 && !extractText.endsWith('\n\n')) {
                                            extractText += '\n';
                                            textToPm.push(pos);
                                        }
                                    } else if (node.type.name === 'hardBreak') {
                                        // Hard breaks should act as a sentence boundary
                                        while (extractText.length > 0 && !extractText.endsWith('\n\n')) {
                                            extractText += '\n';
                                            textToPm.push(pos);
                                        }
                                    } else if (node.isInline && !node.isText) {
                                        // Other inline nodes like images or mentions should act as a space separator
                                        if (extractText.length > 0 && !/\s/.test(extractText[extractText.length - 1])) {
                                            extractText += ' ';
                                            textToPm.push(pos);
                                        }
                                    }
                                    return true; // Continue recursing
                                });
                                // Add a final fallback index
                                textToPm.push(view.state.doc.content.size);

                                // 2. Call our API
                                const langs = getLanguages();
                                console.log("Spellcheck trigger. Languages:", langs, "Text:", extractText);
                                if (langs.length === 0) return;

                                const res = await fetch('/api/spellcheck', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ text: extractText, languages: langs }),
                                });
                                
                                if (!res.ok) {
                                    console.error("Spellcheck fetch failed", res.status);
                                    return;
                                }
                                const { errors } = await res.json();
                                console.log("Spellcheck API returned errors:", errors);

                                // 3. Dispatch errors to ProseMirror state
                                const pmErrors = errors.map((err: any) => ({
                                    from: textToPm[err.offset], 
                                    to: textToPm[err.offset + err.length - 1] + 1,
                                    message: err.message,
                                    replacements: err.replacements
                                })).filter((err: any) => err.from !== undefined && err.to !== undefined && err.from < err.to);

                                console.log("Mapped ProseMirror errors:", pmErrors);
                                const tr = view.state.tr.setMeta(SpellcheckPluginKey, pmErrors);
                                view.dispatch(tr);
                            }, 1000); // 1-second debounce
                        },
                        destroy: () => {
                            clearTimeout(debounceTimer);
                        }
                    };
                },
            }),
        ];
    },
});
