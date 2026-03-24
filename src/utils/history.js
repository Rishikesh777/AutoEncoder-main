/**
 * Utility to manage operation history in localStorage.
 *
 * FIX: Base64 image data is no longer stored in localStorage.
 * Storing full base64 PNG images (can be 500KB–2MB each) quickly exhausts
 * the 5MB localStorage quota, causing silent write failures.
 * Instead we store a lightweight summary and a flag indicating an image exists.
 * The actual watermarked image should be downloaded immediately after embedding.
 */

const HISTORY_KEY = "operation_history";

/**
 * @typedef {Object} HistoryEntry
 * @property {string} id           - Unique operation ID e.g. "OP-1234"
 * @property {string} date         - Human-readable date string
 * @property {"Embed"|"Extract"} type
 * @property {string} imageName    - Original filename
 * @property {string} data         - Embedded or extracted text data
 * @property {"Success"|"Error"} status
 * @property {boolean} hasImage    - True if a watermarked image was produced (Embed)
 * @property {Object} [metadata]   - Optional security/performance metadata
 */

export const getHistory = () => {
    try {
        const history = localStorage.getItem(HISTORY_KEY);
        return history ? JSON.parse(history) : [];
    } catch (error) {
        console.error("Error reading history from localStorage:", error);
        return [];
    }
};

/**
 * Add an entry to history.
 * Pass `resultImageBlob` separately if you want to offer a download — do NOT
 * store it here. We only store text-safe metadata.
 *
 * @param {Object} entry
 * @param {string} entry.type
 * @param {string} entry.imageName
 * @param {string} entry.data
 * @param {"Success"|"Error"} entry.status
 * @param {Object} [entry.metadata]
 */
export const addHistory = (entry) => {
    try {
        const history = getHistory();

        // New feature: Side-by-side comparison in history
        // Store both the original and resulting (watermarked) image
        // To prevent quota exhaustion (5MB limit), we limit image storage to the most recent 5 entries.
        const newEntry = {
            id: `OP-${Math.floor(Math.random() * 9000) + 1000}`,
            date: new Date().toLocaleString(),
            ...entry,
        };

        // Strip images from entries beyond the last 5 to save space
        const updatedHistory = [newEntry, ...history]
            .slice(0, 50)  // total entries cap
            .map((item, index) => {
                if (index >= 5) {
                    const { originalImage, resultImage, ...rest } = item;
                    return { ...rest, hasImage: Boolean(resultImage) };
                }
                return { ...item, hasImage: Boolean(item.resultImage) };
            });

        try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
        } catch (quotaError) {
            // Hard limit reached: strip images from EVERYTHING except the newest
            console.warn("localStorage quota exceeded, stripping old images...");
            const aggressivelyPruned = updatedHistory.map((item, index) => {
                if (index > 0) {
                    const { originalImage, resultImage, ...rest } = item;
                    return { ...rest, hasImage: Boolean(resultImage) };
                }
                return item;
            });
            localStorage.setItem(HISTORY_KEY, JSON.stringify(aggressivelyPruned));
        }

        return newEntry;
    } catch (error) {
        console.error("Error saving history to localStorage:", error);
        return null;
    }
};

export const deleteHistoryEntry = (id) => {
    try {
        const history = getHistory();
        const updatedHistory = history.filter((item) => item.id !== id);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
        return true;
    } catch (error) {
        console.error("Error deleting history entry:", error);
        return false;
    }
};

export const clearHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
};