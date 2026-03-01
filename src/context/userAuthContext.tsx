"use client";
import { useState, createContext, Dispatch, SetStateAction, useContext, ReactNode } from "react";

interface UserAuthContextType {
    userAuth: any;
    setUserAuth: Dispatch<SetStateAction<any>>;
}

const UserAuthContext = createContext<UserAuthContextType | undefined>(undefined);

function UserAuthProvider({ children }: { children: ReactNode }) {
    const [userAuth, setUserAuth] = useState<any>(null);


    return (
        <UserAuthContext.Provider value={{ userAuth, setUserAuth }}>
            {children}
        </UserAuthContext.Provider>
    );
}

function useUserAuth() {
    const context = useContext(UserAuthContext);
    if (context === undefined) {
        throw new Error("useUserAuth must be used within a UserAuthProvider");
    }
    return context;
}

export { UserAuthProvider, useUserAuth };
