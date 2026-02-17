// Page for the login page of the application
'use client'
import Navbar from "@/components/custom/navbar";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { User } from "@supabase/supabase-js";
import { Eye, EyeOff, Info, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SignupPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [clicked, setClicked] = useState(false);
    const [user, setUser] = useState<User | undefined>(undefined)

    const signUp = async () => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
        });

        const { data: userAuth } = await supabase.auth.getUser();
        const { error: profileError } = await supabase
            .from('profiles')
            .insert({
                id: userAuth.user?.id,
                username: email.split('@')[0],
            });

        if (error || profileError) {
            alert(error?.message || profileError?.message);
        } else {
            alert("Signed up successfully 📬");
            router.push("/workspace");
        }

        setClicked(false);
    };

    useEffect(() => {
        const checkLoggedIn = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            setUser(session?.user)
        }
        checkLoggedIn()
    }, [])

    // Check if email is valid
    const emailIsValid = () => {
        // regex for email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    const passwordIsValid = () => {
        // Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
        return passwordRegex.test(password);
    }

    return (
        <div className="bg-background text-foreground min-h-screen w-full pt-48">
            <Navbar user={user} />
            <div className="flex flex-col items-center justify-center gap-4">
                <FieldGroup className="w-full sm:w-[400px] md:w-[524px] mx-auto">
                    <p className="text-2xl font-bold text-center">Sign Up With Google</p>
                    <Separator />
                    <Field>
                        <Button>Sign Up With Google (Coming Soon)</Button>
                    </Field>


                    <p className="text-2xl font-bold text-center mt-10">Sign Up With Email</p>
                    <Separator />
                    <Field>
                        <FieldLabel htmlFor="signup-email">
                            Email
                        </FieldLabel>
                        <Input
                            id="signup-email"
                            placeholder="example@email.com"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <FieldSet className={cn("flex flex-row gap-2 transition-all duration-200", !emailIsValid() && email.length > 0 ? "translate-y-0 opacity-100 h-6" : "translate-y-2 opacity-0 h-0")}>
                            <Info className="text-destructive" size={20} />
                            <p className="text-sm text-destructive">Email is invalid</p>
                        </FieldSet>
                    </Field>
                    <Field>
                        <FieldLabel htmlFor="signup-password">
                            Password
                        </FieldLabel>
                        <div className="relative">
                            <Input
                                id="signup-password"
                                placeholder="••••••••"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="pr-10"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent cursor-pointer"
                                onMouseDown={(e) => {
                                    const input = e.currentTarget.parentElement?.querySelector('input');
                                    if (input) {
                                        input.type = input.type === 'password' ? 'text' : 'password';
                                    }
                                    setShowPassword(!showPassword);
                                }}
                                onMouseUp={(e) => {
                                    const input = e.currentTarget.parentElement?.querySelector('input');
                                    if (input) {
                                        input.type = input.type === 'password' ? 'text' : 'password';
                                    }
                                    setShowPassword(!showPassword);
                                }}
                                onMouseLeave={(e) => {
                                    const input = e.currentTarget.parentElement?.querySelector('input');
                                    if (input) {
                                        input.type = input.type === 'password' ? 'text' : 'password';
                                    }
                                    setShowPassword(!showPassword);
                                }}
                            >
                                {showPassword ? <EyeOff className="text-primary" size={20} /> : <Eye className="text-muted-foreground" size={20} />}
                            </Button>
                        </div>
                        <FieldSet className={cn("flex flex-row gap-2 transition-all duration-200", password.length > 0 && (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) ? "translate-y-0 opacity-100 h-6" : "translate-y-2 opacity-0 h-0")}>
                            <Info className="text-destructive" size={20} />
                            {/* Every single wrong case (Password must be at least 8 characters long, Password must contain at least one uppercase letter, Password must contain at least one lowercase letter, Password must contain at least one number) */}
                            <p className="text-sm text-destructive">{password.length > 0 && (password.length < 8 ? "Password must be at least 8 characters long" : !/[A-Z]/.test(password) ? "Password must contain at least one uppercase letter" : !/[a-z]/.test(password) ? "Password must contain at least one lowercase letter" : !/[0-9]/.test(password) ? "Password must contain at least one number" : "")}</p>
                        </FieldSet>
                        <FieldDescription>
                            *Must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number.
                        </FieldDescription>
                    </Field>
                    <Button onClick={passwordIsValid() && emailIsValid() ? () => { signUp(); setClicked(true) } : () => { }} className={cn("transition-all duration-200", password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) ? "opacity-50 cursor-not-allowed" : "", clicked ? "flex items-center gap-1" : "")}>
                        Sign Up
                        {clicked && <Loader2 className="ml-2 animate-spin text-background z-10" size={20} />}
                    </Button>
                </FieldGroup>
            </div>
        </div >
    );
}
