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

        // FIX: Explicitly strip any base64 image data before storing.
        // Callers previously passed resultImage as a full data URI which caused
        // localStorage quota exhaustion.
        const { resultImage, ...safeEntry } = entry;

        const newEntry = {
            id: `OP-${Math.floor(Math.random() * 9000) + 1000}`,
            date: new Date().toLocaleString(),
            hasImage: Boolean(resultImage),  // only store boolean flag
            ...safeEntry,
        };

        // Keep last 50 entries
        const updatedHistory = [newEntry, ...history].slice(0, 50);

        try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
        } catch (quotaError) {
            // If quota is exceeded even after stripping images, remove oldest half
            console.warn("localStorage quota exceeded, pruning history...");
            const pruned = updatedHistory.slice(0, 25);
            localStorage.setItem(HISTORY_KEY, JSON.stringify(pruned));
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