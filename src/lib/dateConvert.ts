export default function dateConvert(date: string) {
    const input = new Date(date);
    const now = new Date();

    const diffMs = now.getTime() - input.getTime();
    if (diffMs < 0) return "in the future";

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffHours > 0) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;

        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        if (diffMinutes > 0) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;

        const diffSeconds = Math.floor(diffMs / 1000);
        return `${diffSeconds} second${diffSeconds === 1 ? "" : "s"} ago`;
    }
    if (diffDays === 1) return "1 day ago";
    if (diffDays < 30) return `${diffDays} days ago`;

    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12)
        return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;

    const diffYears = Math.floor(diffMonths / 12);
    return `${diffYears} year${diffYears === 1 ? "" : "s"} ago`;
}
