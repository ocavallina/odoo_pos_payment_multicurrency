/** @odoo-module */

import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { patch } from "@web/core/utils/patch";

console.log('[MultiCurrency] Loading HTTP bypass version...');

patch(PaymentScreen.prototype, {
    
    setup() {
        super.setup();
        console.log('[MultiCurrency] Loading with HTTP bypass...');
        this.loadMulticurrencyData();
        //this.createDiagnosticPanel();
    },
    
    async loadMulticurrencyData() {
        try {
            console.log('[MultiCurrency] Fetching data via HTTP controller...');
            
            const response = await fetch('/pos/get_multicurrency_methods', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'call',
                    params: {
                        config_id: this.pos.config.id
                    },
                    id: Date.now()
                })
            });
            
            const data = await response.json();
            
            if (data.result?.success) {
                console.log('[MultiCurrency] HTTP data received:', data.result.methods);
                
                // Update payment methods with multicurrency data
                const paymentMethods = this.pos.models['pos.payment.method'].getAll();
                
                Object.values(data.result.methods).forEach(methodData => {
                    const existingMethod = paymentMethods.find(m => m.id === methodData.id);
                    if (existingMethod) {
                        // Force update multicurrency fields
                        existingMethod.payment_currency_id = methodData.payment_currency_id;
                        existingMethod.exchange_rate_source = methodData.exchange_rate_source;
                        existingMethod.manual_exchange_rate = methodData.manual_exchange_rate;
                        existingMethod.current_exchange_rate = methodData.current_exchange_rate;
                        
                        console.log(`[MultiCurrency] Updated method ${existingMethod.name}:`, {
                            currency: existingMethod.payment_currency_id?.name || 'None',
                            rate: existingMethod.current_exchange_rate
                        });
                    }
                });
                
                // Show success notification
                const configuredCount = Object.values(data.result.methods).filter(m => m.payment_currency_id).length;
                if (configuredCount > 0) {
                    this.showLoadSuccess(configuredCount);
                }
                
            } else {
                console.error('[MultiCurrency] HTTP controller failed:', data.result?.error);
            }
            
        } catch (error) {
            console.error('[MultiCurrency] Error loading multicurrency data:', error);
        }
    },
    
    showLoadSuccess(count) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; 
            top: 20px; 
            right: 20px; 
            background: linear-gradient(45deg, #2196F3, #4CAF50); 
            color: white; 
            padding: 20px; 
            border-radius: 10px; 
            z-index: 999999; 
            font-size: 16px; 
            font-weight: bold; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        
        notification.innerHTML = `
            <div>MULTICURRENCY LOADED VIA HTTP!</div>
            <div style="font-size: 14px; margin-top: 5px;">
                ${count} method${count > 1 ? 's' : ''} with currency configured
            </div>
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    },
    
    async createDiagnosticPanel() {
        setTimeout(async () => {
            await this.runDiagnostic();
        }, 3000); // Wait for HTTP data to load
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
        const paymentMethods = this.pos?.models?.['pos.payment.method']?.getAll() || [];
        const method55 = paymentMethods.find(m => m.id === 55);
        
        // Check if HTTP bypass worked
        const httpWorked = method55?.payment_currency_id ? true : false;
        
        panel.innerHTML = `
            <div style="margin-bottom: 20px; font-size: 18px; font-weight: bold; text-align: center;">
                HTTP BYPASS DIAGNOSTIC
            </div>
            
            <div style="margin-bottom: 15px; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px;">
                <strong>HTTP BYPASS STATUS:</strong><br>
                Method "otro $" (ID: 55): ${httpWorked ? 'CONFIGURED' : 'NOT CONFIGURED'}<br>
                ${httpWorked ? `Currency: ${method55.payment_currency_id.name}<br>Rate: ${method55.current_exchange_rate}` : 'No currency data loaded'}
            </div>
            
            <div style="margin-bottom: 15px; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px;">
                <strong>ALL METHODS STATUS:</strong><br>
                ${paymentMethods.map(m => `${m.name} (ID: ${m.id}): ${m.payment_currency_id ? m.payment_currency_id.name : 'No currency'}`).join('<br>')}
            </div>
            
            ${httpWorked ? `
            <div style="margin-bottom: 15px; background: rgba(0,255,0,0.2); padding: 15px; border-radius: 8px;">
                <strong>SUCCESS! HTTP BYPASS WORKING</strong><br>
                Multi-currency payments should now work correctly.
            </div>
            ` : `
            <div style="margin-bottom: 15px; background: rgba(255,0,0,0.2); padding: 15px; border-radius: 8px;">
                <strong>HTTP BYPASS FAILED</strong><br>
                Check server logs for controller errors.
            </div>
            `}
            
            <div style="text-align: center;">
                <button id="test-payment" style="background: #4CAF50; color: white; border: none; padding: 12px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; margin: 5px;">
                    TEST PAYMENT
                </button>
                <button id="reload-data" style="background: #FF9800; color: white; border: none; padding: 12px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; margin: 5px;">
                    RELOAD DATA
                </button>
                <button id="close-panel" style="background: #f44336; color: white; border: none; padding: 12px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; margin: 5px;">
                    CLOSE
                </button>
            </div>
        `;
        
        document.body.appendChild(panel);
        
        // Event listeners
        panel.querySelector('#test-payment').addEventListener('click', () => {
            panel.remove();
            this.testPayment();
        });
        panel.querySelector('#reload-data').addEventListener('click', () => {
            panel.remove();
            this.loadMulticurrencyData();
        });
        panel.querySelector('#close-panel').addEventListener('click', () => panel.remove());
    },
    
    testPayment() {
        const method55 = this.pos?.models?.['pos.payment.method']?.getAll().find(m => m.id === 55);
        if (method55) {
            console.log('[MultiCurrency] Testing payment with method:', method55.name);
            this.addNewPaymentLine(method55);
        }
    },
    
    addNewPaymentLine(paymentMethod) {
        console.log(`[MultiCurrency] Payment attempt: ${paymentMethod.name} (ID: ${paymentMethod.id})`);
        
        if (paymentMethod.payment_currency_id) {
            console.log('[MultiCurrency] SUCCESS! Multi-currency payment detected');
            this.showSuccess(paymentMethod);
        } else {
            console.log('[MultiCurrency] No currency configured');
            this.showWarning(paymentMethod);
        }
        
        return super.addNewPaymentLine(paymentMethod);
    },
    
    showSuccess(paymentMethod) {
        const notification = document.createElement('div');
        notification.style.cssText = `position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: linear-gradient(45deg, #4CAF50, #8BC34A); color: white; padding: 20px; border-radius: 10px; z-index: 999998; font-size: 18px; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.3); text-align: center;`;
        
        const currency = paymentMethod.payment_currency_id;
        const rate = paymentMethod.current_exchange_rate || 1;
        
        notification.innerHTML = `
            <div>MULTI-CURRENCY SUCCESS!</div>
            <div style="font-size: 16px; margin-top: 5px;">${paymentMethod.name}: ${currency.name}</div>
            <div style="font-size: 14px; opacity: 0.9;">Rate: ${rate.toFixed(4)}</div>
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    },
    
    showWarning(paymentMethod) {
        const warning = document.createElement('div');
        warning.style.cssText = `position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #FF5722; color: white; padding: 15px 20px; border-radius: 10px; z-index: 999997; text-align: center; box-shadow: 0 4px 8px rgba(0,0,0,0.3);`;
        warning.innerHTML = `
            <div>HTTP BYPASS FAILED FOR METHOD "${paymentMethod.name}"</div>
            <div style="font-size: 12px; margin-top: 5px;">Check controller implementation</div>
        `;
        
        document.body.appendChild(warning);
        setTimeout(() => warning.remove(), 8000);
    }
});

console.log('[MultiCurrency] HTTP bypass module loaded');