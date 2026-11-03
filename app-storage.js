
(() => {
    const STORAGE_KEY = "scouting-sprocket.token";

    // Convert absolute local paths to relative paths
    document.querySelectorAll('a[href^="/"]').forEach(link => {
        link.href = `.${link.getAttribute("href")}`;
    });

    function readToken() {
        const raw = localStorage.getItem(STORAGE_KEY);

        if (!raw) {
            throw new Error("No saved token exists.");
        }

        let token;
        try {
            token = JSON.parse(raw);
        } catch {
            throw new Error("The saved token is invalid.");
        }

        if (!token || typeof token !== "object" || !Array.isArray(token.sections)) {
            throw new Error("The saved token is malformed.");
        }

        return token;
    }

    function saveToken(token, requireUnlocked = false) {
        if (!token || typeof token !== "object" || Array.isArray(token) ||
            !Array.isArray(token.sections)) {
            throw new Error("The token must contain a sections array.");
        }

        if (requireUnlocked) {
            const current = (() => {
                try {
                    return readToken();
                } catch {
                    return null;
                }
            })();

            if (current?.lock?.enabled) {
                throw new Error("The form and Settings are locked.");
            }
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(token));
    }

    function importToken(token) {
        saveToken(token, true);
    }

    function lock(action, password) {
        if (typeof password !== "string" || !password.trim()) {
            throw new Error("A password is required.");
        }

        let token;

        try {
            token = readToken();
        } catch {
            token = {
                name: "New Scouting Form",
                sections: [],
                responses: []
            };
        }

        if (action === "unlock") {
            if (!token.lock?.enabled || token.lock.password !== password) {
                throw new Error("Incorrect password.");
            }

            token.lock = {
                enabled: false,
                password: null
            };

        } else if (action === "lock") {
            if (token.lock?.enabled) {
                throw new Error("The form is already locked.");
            }

            token.lock = {
                enabled: true,
                password
            };

        } else {
            throw new Error("Unknown lock action.");
        }

        // Internal lock operations bypass the external lock check
        saveToken(token);
    }

    function wipe() {
        saveToken({
            name: "New Scouting Form",
            sections: [],
            responses: [],
            lock: {
                enabled: false,
                password: null
            }
        }, true);
    }

    window.SprocketStorage = Object.freeze({
        readToken,
        saveToken,
        importToken,
        lock,
        wipe
    });
})();
