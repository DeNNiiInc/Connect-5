// Database Status Monitor
class DatabaseStatusMonitor {
    constructor() {
        this.updateInterval = 5000; // 5 seconds
        this.intervalId = null;
        this.elements = {
            connection: document.getElementById('dbConnection'),
            latency: document.getElementById('dbLatency'),
            write: document.getElementById('dbWrite'),
            timestamp: document.getElementById('dbTimestamp')
        };
    }

    async checkStatus() {
        try {
            const response = await fetch('/api/db-status');
            const data = await response.json();
            
            this.updateUI(data);
        } catch (error) {
            console.error('Failed to fetch database status:', error);
            this.updateUI({
                connected: false,
                latency: 0,
                writeCapable: false,
                error: 'Failed to connect to server'
            });
        }
    }

    updateUI(status) {
        // Update connection status
        const connectionDot = this.elements.connection.querySelector('.status-dot');
        const connectionText = this.elements.connection.querySelector('.status-text');
        
        if (status.connected) {
            connectionDot.className = 'status-dot status-connected';
            connectionText.textContent = 'Connected';
            this.elements.connection.classList.remove('status-error');
            this.elements.connection.classList.add('status-success');
        } else {
            connectionDot.className = 'status-dot status-disconnected';
            connectionText.textContent = 'Disconnected';
            this.elements.connection.classList.remove('status-success');
            this.elements.connection.classList.add('status-error');
        }

        // Update latency
        if (status.connected && status.latency > 0) {
            this.elements.latency.textContent = `${status.latency} ms`;
            
            // Color code based on latency
            if (status.latency < 50) {
                this.elements.latency.className = 'db-status-value latency-good';
            } else if (status.latency < 150) {
                this.elements.latency.className = 'db-status-value latency-ok';
            } else {
                this.elements.latency.className = 'db-status-value latency-slow';
            }
        } else {
            this.elements.latency.textContent = '-- ms';
            this.elements.latency.className = 'db-status-value';
        }

        // Update write capability
        const writeDot = this.elements.write.querySelector('.status-dot');
        const writeText = this.elements.write.querySelector('.status-text');
        
        if (status.writeCapable) {
            writeDot.className = 'status-dot status-connected';
            writeText.textContent = 'Enabled';
            this.elements.write.classList.remove('status-error', 'status-warning');
            this.elements.write.classList.add('status-success');
        } else if (status.connected) {
            writeDot.className = 'status-dot status-warning';
            writeText.textContent = 'Read-Only';
            this.elements.write.classList.remove('status-error', 'status-success');
            this.elements.write.classList.add('status-warning');
        } else {
            writeDot.className = 'status-dot status-disconnected';
            writeText.textContent = 'Disabled';
            this.elements.write.classList.remove('status-success', 'status-warning');
            this.elements.write.classList.add('status-error');
        }

        // Update timestamp
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: false 
        });
        this.elements.timestamp.textContent = timeString;
    }

    start() {
        // Initial check
        this.checkStatus();
        
        // Set up periodic checks
        this.intervalId = setInterval(() => {
            this.checkStatus();
        }, this.updateInterval);
        
        console.log('✅ Database status monitor started');
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('⏹️ Database status monitor stopped');
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.dbStatusMonitor = new DatabaseStatusMonitor();
    window.dbStatusMonitor.start();
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (window.dbStatusMonitor) {
        window.dbStatusMonitor.stop();
    }
});
