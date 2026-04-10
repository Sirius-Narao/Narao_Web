"use client";
import { useState, createContext, Dispatch, SetStateAction, useContext, ReactNode } from "react";
import { ReviewItemType } from "@/types/reviewItemType";

interface ReviewContextType {
    reviews: ReviewItemType[];
    setReviews: Dispatch<SetStateAction<ReviewItemType[]>>;
}


const ReviewContext = createContext<ReviewContextType | undefined>(undefined);

function ReviewProvider({ children }: { children: ReactNode }) {
    const [reviews, setReviews] = useState<ReviewItemType[]>([]);


    return (
        <ReviewContext.Provider value={{ reviews, setReviews }}>
            {children}
        </ReviewContext.Provider>
    );
}

function useReviews() {
    const context = useContext(ReviewContext);
    if (context === undefined) {
        throw new Error("useReviews must be used within a ReviewProvider");
    }
    return context;
}

export { ReviewProvider, useReviews };

