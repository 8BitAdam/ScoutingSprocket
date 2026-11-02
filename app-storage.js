(() => {
    const STORAGE_KEY = "scouting-sprocket.token";

    document.querySelectorAll('a[href^="/"]').forEach(link => {
        link.href = `.${link.getAttribute("href")}`;
    });

    function readToken() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) throw new Error("No saved token exists.");
        try {
            return JSON.parse(raw);
        } catch {
            throw new Error("The saved token is invalid.");
        }
    }

    function saveToken(token, requireUnlocked = false) {
        if (!token || typeof token !== "object" || !Array.isArray(token.sections)) {
            throw new Error("The token must contain a sections array.");
        }
        if (requireUnlocked && JSON.parse(localStorage.getItem(STORAGE_KEY) || "null")?.lock?.enabled) {
            throw new Error("The form and Settings are locked.");
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(token));
    }

    function importToken(token) {
        saveToken(token, true);
    }

    function lock(action, password) {
        if (!password) throw new Error("A password is required.");
        const token = (() => {
            try { return readToken(); } catch { return {}; }
        })();
        const storedPassword = token.lock?.password;
        if (action === "unlock") {
            if (!token.lock?.enabled || storedPassword !== password) {
                throw new Error("Incorrect password.");
            }
            token.lock = { enabled: false, password: storedPassword };
        } else if (action === "lock") {
            token.lock = { enabled: true, password };
        } else {
            throw new Error("Unknown lock action.");
        }
        saveToken(token);
    }

    function wipe() {
        const token = readToken();
        saveToken({ ...token, name: "New Scouting Form", sections: [], responses: [] }, true);
    }

    window.SprocketStorage = Object.freeze({ readToken, saveToken, importToken, lock, wipe });
})();
