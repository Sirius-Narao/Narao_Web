import ChatType from "@/types/chatType";
import quantifyDate from "./quantifyDate";

export default function handleSearch(query: string, chatList: ChatType[]) {
    const sortedList = [...chatList].sort((a, b) => quantifyDate(b.date) - quantifyDate(a.date));

    if (query === "") {
        return (sortedList);
    }

    const lowerQuery = query.toLowerCase();

    const titleMatches = sortedList.filter(chat => chat.title.toLowerCase().includes(lowerQuery));
    const descMatches = sortedList.filter(chat =>
        !chat.title.toLowerCase().includes(lowerQuery) &&
        chat.description.toLowerCase().includes(lowerQuery)
    );

    return ([...titleMatches, ...descMatches]);
};