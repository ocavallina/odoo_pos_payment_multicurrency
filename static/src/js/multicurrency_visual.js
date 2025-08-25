/** @odoo-module */

import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { patch } from "@web/core/utils/patch";

console.log('[MultiCurrency] Loading clean diagnostic module...');

patch(PaymentScreen.prototype, {
    
    setup() {
        super.setup();
        console.log('[MultiCurrency] Clean diagnostic - checking backend vs frontend sync');
        this.createDiagnosticPanel();
    },
    
    async createDiagnosticPanel() {
        setTimeout(async () => {
            await this.runDiagnostic();
        }, 2000);
    },
    
    async runDiagnostic() {
        console.log('[MultiCurrency] Running diagnostic...');
        
        const existingPanel = document.querySelector('.sync-diagnostic-panel');
        if (existingPanel) existingPanel.remove();
        
        const panel = document.createElement('div');
        panel.className = 'sync-diagnostic-panel';
        panel.style.cssText = `
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            background: linear-gradient(45deg, #E91E63, #9C27B0) !important;
            color: white !important;
            padding: 30px !important;
            border-radius: 15px !important;
            z-index: 999999 !important;
            font-size: 14px !important;
            max-width: 700px !important;
            font-family: monospace !important;
            line-height: 1.4 !important;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5) !important;
            border: 3px solid #ffffff !important;
            max-height: 90vh !important;
            overflow-y: auto !important;
        `;
        
        // Frontend data
        const config = this.pos?.config;
        const currencies = this.pos?.models?.['res.currency']?.getAll() || [];
        const paymentMethods = this.pos?.models?.['pos.payment.method']?.getAll() || [];
        const dollarMethod = paymentMethods.find(m => m.id === 54);
        
        // Backend data
        let backendData = null;
        let backendError = null;
        
        try {
            console.log('[MultiCurrency] Fetching backend data using POS data service...');
            
            backendData = await this.pos.data.call('pos.config', 'read', [
                [config.id], 
                ['multi_currency_payments', 'base_currency_id']
            ]);
            
            const backendCurrencies = await this.pos.data.call('res.currency', 'search_read', [
                [['active', '=', true]], 
                ['name', 'symbol', 'active']
            ]);
            
            const backendPaymentMethod = await this.pos.data.call('pos.payment.method', 'read', [
                [54],
                ['name', 'payment_currency_id', 'exchange_rate_source', 'manual_exchange_rate', 'current_exchange_rate']
            ]);
            
            backendData[0].backend_currencies = backendCurrencies;
            backendData[0].backend_payment_method = backendPaymentMethod[0] || null;
            
            console.log('[MultiCurrency] Backend data fetched successfully:', backendData[0]);
            
        } catch (error) {
            console.error('[MultiCurrency] Error fetching backend data:', error);
            backendError = error.message;
        }
        
        // Analysis
        const frontendUSD = currencies.find(c => c.name === 'USD');
        const backendUSD = backendData?.[0]?.backend_currencies?.find(c => c.name === 'USD');
        const syncIssues = [];
        
        if (currencies.length < 2 && backendData?.[0]?.backend_currencies?.length >= 2) {
            syncIssues.push('USD active in backend but not loaded in frontend');
        }
        
        if (backendData?.[0]?.backend_payment_method?.payment_currency_id && !dollarMethod?.payment_currency_id) {
            syncIssues.push('Method "$" has currency in backend but not in frontend');
        }
        
        if (!frontendUSD && backendUSD) {
            syncIssues.push('USD currency sync issue');
        }
        
        panel.innerHTML = `
            <div style="margin-bottom: 20px; font-size: 18px; font-weight: bold; text-align: center;">
                MULTI-CURRENCY DIAGNOSTIC
            </div>
            
            <div style="margin-bottom: 15px; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px;">
                <strong>FRONTEND DATA:</strong><br>
                • Multi-currency: ${config?.multi_currency_payments ? 'YES' : 'NO'}<br>
                • Base currency: ${config?.base_currency_id ? 'SET (' + (config.base_currency_id.name || 'Unknown') + ')' : 'UNDEFINED'}<br>
                • Currencies: ${currencies.length} (${currencies.map(c => c.name).join(', ')})<br>
                • USD in frontend: ${frontendUSD ? 'YES' : 'NO'}<br>
                • Method "$" currency: ${dollarMethod?.payment_currency_id ? dollarMethod.payment_currency_id.name : 'UNDEFINED'}<br>
            </div>
            
            <div style="margin-bottom: 15px; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px;">
                <strong>BACKEND DATA:</strong><br>
                ${backendError ? `
                    Error: ${backendError}
                ` : backendData ? `
                    • Multi-currency: ${backendData[0].multi_currency_payments ? 'YES' : 'NO'}<br>
                    • Base currency: ${backendData[0].base_currency_id ? backendData[0].base_currency_id[1] : 'NULL'}<br>
                    • Currencies: ${backendData[0].backend_currencies?.length || '?'} (${backendData[0].backend_currencies?.map(c => c.name).join(', ') || 'N/A'})<br>
                    • USD in backend: ${backendUSD ? 'YES' : 'NO'}<br>
                    • Method "$" currency: ${backendData[0].backend_payment_method?.payment_currency_id ? backendData[0].backend_payment_method.payment_currency_id[1] : 'NULL'}
                ` : 'Loading...'}
            </div>
            
            <div style="margin-bottom: 15px; background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px;">
                <strong>ISSUES DETECTED:</strong><br>
                ${syncIssues.length > 0 ? 
                    syncIssues.map(issue => `• ${issue}`).join('<br>') :
                    'No major sync issues detected'
                }<br>
                ${currencies.length < 2 ? '• Only 1 currency loaded (should be 2+)<br>' : ''}
                ${!dollarMethod?.payment_currency_id ? '• Method "$" has no currency configured<br>' : ''}
            </div>
            
            <div style="margin-bottom: 20px; background: rgba(255,193,7,0.2); padding: 10px; border-radius: 5px;">
                <strong>SOLUTIONS:</strong><br>
                ${!backendUSD ? '1. USD not active - Go activate it in Accounting<br>' : ''}
                ${backendUSD && !frontendUSD ? '2. USD active but not loaded - Restart POS<br>' : ''}
                ${!backendData?.[0]?.backend_payment_method?.payment_currency_id ? '3. Configure method "$" with USD<br>' : ''}
                ${backendData?.[0]?.backend_payment_method?.payment_currency_id && !dollarMethod?.payment_currency_id ? '4. Method configured but not synced - Restart POS<br>' : ''}
                5. Try FORCE RELOAD button below
            </div>
            
            <div style="text-align: center;">
                <button id="force-reload" style="background: #4CAF50; color: white; border: none; padding: 12px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; margin: 5px;">
                    FORCE RELOAD
                </button>
                <button id="restart-pos" style="background: #FF9800; color: white; border: none; padding: 12px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; margin: 5px;">
                    RESTART POS
                </button>
                <button id="close-panel" style="background: #f44336; color: white; border: none; padding: 12px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; margin: 5px;">
                    CLOSE
                </button>
            </div>
            
            <div style="margin-top: 15px; font-size: 11px; text-align: center; opacity: 0.8;">
                Backend calls: ${backendError ? 'Failed' : 'Success'} | 
                Sync status: ${syncIssues.length === 0 ? 'Good' : 'Issues found'}
            </div>
        `;
        
        document.body.appendChild(panel);
        
        // Event listeners
        panel.querySelector('#force-reload').addEventListener('click', () => this.forceReload());
        panel.querySelector('#restart-pos').addEventListener('click', () => this.restartPos());
        panel.querySelector('#close-panel').addEventListener('click', () => panel.remove());
    },
    
    async forceReload() {
        console.log('[MultiCurrency] Force reloading...');
        try {
            // Show loading
            const loading = document.createElement('div');
            loading.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.8); color: white; padding: 20px; border-radius: 10px; z-index: 9999999; text-align: center;`;
            loading.innerHTML = 'Reloading data...';
            document.body.appendChild(loading);
            
            // Force reload currencies
            const currencies = await this.pos.data.call('res.currency', 'search_read', [
                [['active', '=', true]], ['name', 'symbol', 'rounding', 'position']
            ]);
            console.log('[MultiCurrency] Fresh currencies:', currencies);
            
            // Force reload payment methods
            const methods = await this.pos.data.call('pos.payment.method', 'search_read', [
                [['id', 'in', this.pos.config.payment_method_ids.map(pm => pm.id)]],
                ['name', 'payment_currency_id', 'exchange_rate_source', 'manual_exchange_rate', 'current_exchange_rate']
            ]);
            console.log('[MultiCurrency] Fresh methods:', methods);
            
            // Update models
            if (currencies.length > this.pos.models['res.currency'].getAll().length) {
                this.pos.models['res.currency'].loadData(currencies, [], false);
            }
            this.pos.models['pos.payment.method'].loadData(methods, [], false);
            
            loading.remove();
            
            // Show success
            const success = document.createElement('div');
            success.style.cssText = loading.style.cssText.replace('rgba(0,0,0,0.8)', '#4CAF50');
            success.innerHTML = 'Data reloaded! Check for changes...';
            document.body.appendChild(success);
            setTimeout(() => success.remove(), 3000);
            
            // Re-run diagnostic
            setTimeout(() => this.runDiagnostic(), 2000);
            
        } catch (error) {
            console.error('[MultiCurrency] Error reloading:', error);
            alert('Error reloading: ' + error.message);
        }
    },
    
    restartPos() {
        if (confirm('Restart POS session? This will reload the page.')) {
            window.location.reload();
        }
    },
    
    addNewPaymentLine(paymentMethod) {
        console.log(`[MultiCurrency] Payment attempt: ${paymentMethod.name} (ID: ${paymentMethod.id})`);
        
        if (paymentMethod.payment_currency_id) {
            console.log('[MultiCurrency] SUCCESS! Multi-currency payment detected');
            this.showSuccess(paymentMethod);
        } else {
            console.log('[MultiCurrency] No currency configured');
            if (paymentMethod.id === 54) {
                console.log('[MultiCurrency] This is method "$" - should have USD!');
                this.showWarning();
            }
        }
        
        return super.addNewPaymentLine(paymentMethod);
    },
    
    showSuccess(paymentMethod) {
        const notification = document.createElement('div');
        notification.style.cssText = `position: fixed; top: 20px; right: 20px; background: linear-gradient(45deg, #4CAF50, #8BC34A); color: white; padding: 20px; border-radius: 10px; z-index: 999998; font-size: 18px; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.3);`;
        
        const currency = paymentMethod.payment_currency_id;
        const rate = paymentMethod.current_exchange_rate || 1;
        
        notification.innerHTML = `
            <div>MULTI-CURRENCY SUCCESS!</div>
            <div style="font-size: 16px;">${paymentMethod.name}: ${currency.name}</div>
            <div style="font-size: 14px; opacity: 0.9;">Rate: ${rate.toFixed(4)}</div>
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    },
    
    showWarning() {
        const warning = document.createElement('div');
        warning.style.cssText = `position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #FF5722; color: white; padding: 15px 20px; border-radius: 10px; z-index: 999997; text-align: center; box-shadow: 0 4px 8px rgba(0,0,0,0.3);`;
        warning.innerHTML = `
            <div>METHOD "$" NEEDS USD CONFIGURATION!</div>
            <div style="font-size: 12px; margin-top: 5px;">Backend → POS → Payment Methods → "$" → Set USD</div>
        `;
        
        document.body.appendChild(warning);
        setTimeout(() => warning.remove(), 8000);
    }
});

console.log('[MultiCurrency] Clean diagnostic module loaded');