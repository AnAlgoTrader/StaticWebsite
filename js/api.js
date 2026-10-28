const API = {
    async getStatus() {
        // If hosted on GitHub Pages or static host, load data/status.json
        if (window.location.hostname.endsWith('github.io')) {
            try {
                const res = await fetch('data/status.json');
                if (res.ok) return await res.json();
            } catch (e) {}
            return { hasToken: true, hasQuery: true, lastSync: null, staticMode: true, source: 'github-actions' };
        }

        try {
            const res = await fetch('/api/status');
            if (res.ok) return await res.json();
        } catch (e) {}

        try {
            const res = await fetch('data/status.json');
            if (res.ok) return await res.json();
        } catch (e) {}

        return { hasToken: false, hasQuery: false, lastSync: null };
    },

    async getTrades() {
        if (window.location.hostname.endsWith('github.io')) {
            const res = await fetch('data/trades.json');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        }

        try {
            const res = await fetch('/api/trades');
            if (res.ok) return await res.json();
        } catch (e) {}

        const res = await fetch('data/trades.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    },

    async syncFromIBKR() {
        if (window.location.hostname.endsWith('github.io')) {
            return {
                notice: 'Sync is automated via GitHub Actions. Trades update automatically on schedule, or you can trigger a manual sync in the Actions tab of your repository.'
            };
        }

        try {
            const res = await fetch('/api/sync', { method: 'POST' });
            return await res.json();
        } catch (e) {
            return { error: e.message };
        }
    },

    async uploadXML(file) {
        if (window.location.hostname.endsWith('github.io')) {
            return { error: 'XML upload requires the local Express backend.' };
        }

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/xml'
                },
                body: file
            });
            return await res.json();
        } catch (e) {
            return { error: e.message };
        }
    },

    async clearData() {
        if (window.location.hostname.endsWith('github.io')) {
            return { error: 'Clearing trade data is disabled on static GitHub Pages deployment.' };
        }

        try {
            const res = await fetch('/api/trades', { method: 'DELETE' });
            return await res.json();
        } catch (e) {
            return { error: e.message };
        }
    }
};
