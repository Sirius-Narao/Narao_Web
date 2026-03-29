import { Settings } from "./settingsType";

type ProfileType = {
    id: string;
    username: string;
    created_at: string;
    settings: Settings;
};

export default ProfileType;
