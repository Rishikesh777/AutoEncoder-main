/**
 * Utility to manage operation history in localStorage
 */

const HISTORY_KEY = "operation_history";

export const getHistory = () => {
    try {
        const history = localStorage.getItem(HISTORY_KEY);
        return history ? JSON.parse(history) : [];
    } catch (error) {
        console.error("Error reading history from localStorage:", error);
        return [];
    }
};

export const addHistory = (entry) => {
    try {
        const history = getHistory();
        const newEntry = {
            id: `OP-${Math.floor(Math.random() * 9000) + 1000}`,
            date: new Date().toLocaleString(),
            ...entry,
        };
        const updatedHistory = [newEntry, ...history].slice(0, 50); // Keep last 50 entries
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
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
