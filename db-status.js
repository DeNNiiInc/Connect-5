// Database Status Monitor
class DatabaseStatusMonitor {
    constructor() {
        this.updateInterval = 5000; // 5 seconds
        this.intervalId = null;
        this.elements = {
            connection: document.getElementById('dbConnection'),
            latency: document.getElementById('dbLatency'),
            write: document.getElementById('dbWrite'),
            timestamp: document.getElementById('dbTimestamp'),
            retryBtn: document.getElementById('dbRetryBtn'),
            statusBar: document.getElementById('dbStatusBar'),
            detailsPanel: document.getElementById('dbStatusDetails'),
            errorBanner: document.getElementById('sqlErrorBanner'),
            errorMessage: document.getElementById('sqlErrorMessage'),
            errorDetails: document.getElementById('sqlErrorDetails')
        };
        this.logs = [];
        this.maxLogs = 50;
        
        // Make status bar clickable to show details
        if (this.elements.statusBar) {
            this.elements.statusBar.style.cursor = 'pointer';
            this.elements.statusBar.addEventListener('click', (e) => {
                // Don't toggle if clicking the retry button
                if (!e.target.closest('.db-retry-btn')) {
                    this.toggleDetails();
                }
            });
        }
    }

    addLog(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString('en-US', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        const logEntry = {
            timestamp,
            message,
            type // 'info', 'success', 'error', 'warning'
        };
        
        this.logs.unshift(logEntry);
        if (this.logs.length > this.maxLogs) {
            this.logs.pop();
        }
        
        // Console logging with emoji
        const emoji = {
            'info': 'ℹ️',
            'success': '✅',
            'error': '❌',
            'warning': '⚠️'
        };
        
        console.log(`${emoji[type]} [DB-STATUS ${timestamp}] ${message}`);
        
        // Update logs display
        this.updateLogsDisplay();
    }

    updateLogsDisplay() {
        const logsContainer = document.getElementById('detailLogs');
        if (!logsContainer) return;
        
        logsContainer.innerHTML = '<div class="db-logs-title">Recent Logs:</div>';
        this.logs.slice(0, 20).forEach(log => {
            const logDiv = document.createElement('div');
            logDiv.className = `db-log-entry db-log-${log.type}`;
            logDiv.textContent = `[${log.timestamp}] ${log.message}`;
            logsContainer.appendChild(logDiv);
        });
    }

    toggleDetails() {
        if (this.elements.detailsPanel) {
            const isHidden = this.elements.detailsPanel.style.display === 'none';
            this.elements.detailsPanel.style.display = isHidden ? 'block' : 'none';
            if (isHidden) {
                this.addLog('Details panel opened', 'info');
            }
        }
    }

    async checkStatus() {
        this.addLog('Checking database status...', 'info');
        
        try {
            const response = await fetch('/api/db-status');
            const data = await response.json();
            
            this.addLog(`Response received: ${data.connected ? 'Connected' : 'Disconnected'}`, 
                       data.connected ? 'success' : 'error');
            
            if (data.error) {
                this.addLog(`Error: ${data.error}`, 'error');
            }
            
            if (data.poolStats) {
                this.addLog(`Pool: ${data.poolStats.freeConnections}/${data.poolStats.totalConnections} free, ${data.poolStats.queuedRequests} queued`, 'info');
            }
            
            this.updateUI(data);
            this.updateDetails(data);
            this.updateErrorBanner(data);
        } catch (error) {
            this.addLog(`Failed to fetch status: ${error.message}`, 'error');
            console.error('Failed to fetch database status:', error);
            const errorData = {
                connected: false,
                latency: 0,
                writeCapable: false,
                error: 'Failed to connect to server'
            };
            this.updateUI(errorData);
            this.updateErrorBanner(errorData);
        }
    }

    updateErrorBanner(status) {
        if (!this.elements.errorBanner) return;

        if (!status.connected || status.error) {
            // Show error banner
            this.elements.errorBanner.style.display = 'block';
            
            // Update error message
            if (this.elements.errorMessage) {
                this.elements.errorMessage.textContent = status.error || 'Connection failed';
            }
            
            // Update error details
            if (this.elements.errorDetails) {
                const details = [];
                
                if (status.host) {
                    details.push(`🖥️ Host: ${status.host}`);
                }
                if (status.database) {
                    details.push(`🗄️ Database: ${status.database}`);
                }
                if (status.user) {
                    details.push(`👤 User: ${status.user}`);
                }
                if (status.latency !== undefined) {
                    details.push(`⏱️ Latency: ${status.latency}ms`);
                }
                if (status.poolStats) {
                    details.push(`🔗 Pool: ${status.poolStats.freeConnections}/${status.poolStats.totalConnections} free`);
                }
                
                details.push(`🕐 Last Check: ${new Date().toLocaleTimeString()}`);
                
                this.elements.errorDetails.innerHTML = details.map(d => 
                    `<div class="sql-error-detail-item">${d}</div>`
                ).join('');
            }
        } else {
            // Hide error banner when connected
            this.elements.errorBanner.style.display = 'none';
        }
    }

    updateDetails(status) {
        // Update detail panel
        const detailStatus = document.getElementById('detailStatus');
        const detailHost = document.getElementById('detailHost');
        const detailDatabase = document.getElementById('detailDatabase');
        const detailError = document.getElementById('detailError');
        
        if (detailStatus) {
            detailStatus.textContent = status.connected ? '✅ Connected' : '❌ Disconnected';
            detailStatus.style.color = status.connected ? '#10b981' : '#ef4444';
        }
        
        if (detailHost) {
            detailHost.textContent = status.host || 'unknown';
        }
        
        if (detailDatabase) {
            detailDatabase.textContent = status.database || 'unknown';
        }
        
        if (detailError) {
            if (status.error) {
                detailError.textContent = status.error;
                detailError.style.color = '#ef4444';
            } else {
                detailError.textContent = 'None';
                detailError.style.color = '#10b981';
            }
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

    async retryConnection() {
        this.addLog('🔄 Manual retry triggered', 'info');
        
        // Visual feedback on button
        if (this.elements.retryBtn) {
            this.elements.retryBtn.disabled = true;
            this.elements.retryBtn.classList.add('retrying');
            const originalText = this.elements.retryBtn.innerHTML;
            this.elements.retryBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinning">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                </svg>
                Retrying...
            `;
            
            await this.checkStatus();
            
            setTimeout(() => {
                this.elements.retryBtn.disabled = false;
                this.elements.retryBtn.classList.remove('retrying');
                this.elements.retryBtn.innerHTML = originalText;
            }, 1000);
        } else {
            await this.checkStatus();
        }
    }

    start() {
        // Initial check
        this.addLog('Database status monitor started', 'success');
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
            this.addLog('Database status monitor stopped', 'warning');
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
