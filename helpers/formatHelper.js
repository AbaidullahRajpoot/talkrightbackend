class FormatHelper {
    static formatDuration(seconds) {
        if (!seconds) return '0m 0s';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}m ${remainingSeconds}s`;
    }

    static formatDate(date) {
        return new Date(date).toISOString().split('T')[0];
    }

    // Add more helper methods as needed
}

module.exports = FormatHelper; 