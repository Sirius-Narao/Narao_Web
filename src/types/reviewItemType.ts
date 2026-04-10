export type ReviewItemType = {
    id: string;
    title: string;
    query: string;
    createdAt: Date;
    importance: 1 | 2 | 3;
    type: "typo" | "suggestion" | "question";
    location: string;
    chatId: string;
}