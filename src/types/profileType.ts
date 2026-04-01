import { Settings } from "./settingsType";

type ProfileType = {
    id: string;
    username: string;
    created_at: string;
    settings: Settings;
    credits_left: number;
};

export default ProfileType;
