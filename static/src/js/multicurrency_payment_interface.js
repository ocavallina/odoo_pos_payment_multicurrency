/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { useState } from "@odoo/owl";

console.log('[MultiCurrency Interface] Loading payment interface...');

patch(PaymentScreen.prototype, {
    
    setup() {
        super.setup();
        this.multicurrencyState = useState({
            showCurrencyInput: false,
            selectedMethod: null,
            currencyAmount: '',
            convertedAmount: 0,
            exchangeRate: 1,
            currencySymbol: '',
            currencyName: ''
        });
    },

    addNewPaymentLine(paymentMethod) {
        console.log(`[MultiCurrency Interface] Adding payment: ${paymentMethod.name}`);
        
        if (paymentMethod.payment_currency_id) {
            console.log(`[MultiCurrency Interface] Foreign currency method: ${paymentMethod.payment_currency_id.name}`);
            this.showMultiCurrencyInterface(paymentMethod);
            return;
        }
        
        return super.addNewPaymentLine(paymentMethod);
    },

    showMultiCurrencyInterface(paymentMethod) {
        const currency = paymentMethod.payment_currency_id;
        const rate = paymentMethod.current_exchange_rate || 1;
        const baseCurrency = this.pos.config.currency_id || { name: 'Unknown', symbol: '$' };
        
        this.multicurrencyState.showCurrencyInput = true;
        this.multicurrencyState.selectedMethod = paymentMethod;
        this.multicurrencyState.exchangeRate = rate;
        this.multicurrencyState.currencySymbol = currency.symbol || currency.name;
        this.multicurrencyState.currencyName = currency.name;
        this.multicurrencyState.currencyAmount = '';
        this.multicurrencyState.convertedAmount = 0;
        
        this.createCurrencyInputModal();
    },

    createCurrencyInputModal() {
        const method = this.multicurrencyState.selectedMethod;
        const currency = method.payment_currency_id;
        const rate = this.multicurrencyState.exchangeRate;
        const baseCurrency = this.pos.config.currency_id || { name: 'Unknown', symbol: '$' };
        
        const modal = document.createElement('div');
        modal.className = 'multicurrency-input-modal';
        modal.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: rgba(0,0,0,0.7) !important;
            z-index: 999999 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white !important;
            border-radius: 15px !important;
            padding: 30px !important;
            min-width: 400px !important;
            max-width: 500px !important;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5) !important;
            text-align: center !important;
        `;
        
        let orderTotal = 0;
        let pendingAmount = 0;
        
        try {
            const order = this.pos.get_order();
            if (order) {
                orderTotal = order.get_total_with_tax();
                pendingAmount = orderTotal - order.get_total_paid();
            }
        } catch (e) {
            console.warn('[MultiCurrency Interface] Error getting order totals:', e);
            pendingAmount = 100;
        }
        
        const suggestedForeignAmount = (pendingAmount / rate).toFixed(2);
        
        const formatCurrency = (amount, currencySymbol = baseCurrency.symbol || '$') => {
            return `${currencySymbol}${amount.toFixed(2)}`;
        };
        
        modalContent.innerHTML = `
            <div style="margin-bottom: 20px;">
                <h3 style="color: #2c3e50; margin-bottom: 10px;">Pago en ${currency.name}</h3>
                <div style="color: #7f8c8d; font-size: 14px;">Método: ${method.name}</div>
            </div>
            
            <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <div style="font-size: 14px; color: #6c757d; margin-bottom: 5px;">Pendiente por pagar:</div>
                <div style="font-size: 18px; font-weight: bold; color: #2c3e50;">
                    ${formatCurrency(pendingAmount)}
                </div>
                <div style="font-size: 12px; color: #6c757d; margin-top: 5px;">
                    ≈ ${currency.symbol}${suggestedForeignAmount} ${currency.name}
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; font-weight: bold; margin-bottom: 10px; color: #2c3e50;">
                    Monto recibido en ${currency.name}:
                </label>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 20px; font-weight: bold; color: #2c3e50;">${currency.symbol}</span>
                    <input 
                        type="number" 
                        id="currency-amount-input"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        style="
                            flex: 1;
                            padding: 12px;
                            font-size: 18px;
                            border: 2px solid #3498db;
                            border-radius: 8px;
                            text-align: right;
                            font-weight: bold;
                        "
                        value="${suggestedForeignAmount}"
                    />
                </div>
            </div>
            
            <div style="margin-bottom: 20px; padding: 15px; background: #e8f5e8; border-radius: 8px; border-left: 4px solid #28a745;">
                <div style="color: #155724; font-size: 14px; margin-bottom: 5px;">Equivalente en ${baseCurrency.name}:</div>
                <div id="converted-amount" style="font-size: 24px; font-weight: bold; color: #28a745;">
                    ${formatCurrency(parseFloat(suggestedForeignAmount) * rate)}
                </div>
                <div style="color: #6c757d; font-size: 12px; margin-top: 5px;">
                    Tasa: 1 ${currency.name} = ${rate.toFixed(4)} ${baseCurrency.name}
                </div>
            </div>
            
            <div style="display: flex; gap: 10px;">
                <button id="cancel-currency-payment" style="
                    flex: 1;
                    padding: 12px;
                    background: #6c757d;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                ">Cancelar</button>
                <button id="confirm-currency-payment" style="
                    flex: 1;
                    padding: 12px;
                    background: #28a745;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                ">Confirmar Pago</button>
            </div>
        `;
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        const input = modal.querySelector('#currency-amount-input');
        const convertedAmountEl = modal.querySelector('#converted-amount');
        
        input.addEventListener('input', (e) => {
            const amount = parseFloat(e.target.value) || 0;
            const converted = amount * rate;
            convertedAmountEl.textContent = formatCurrency(converted);
            this.multicurrencyState.currencyAmount = amount;
            this.multicurrencyState.convertedAmount = converted;
        });
        
        modal.querySelector('#cancel-currency-payment').addEventListener('click', () => {
            modal.remove();
            this.multicurrencyState.showCurrencyInput = false;
        });
        
        modal.querySelector('#confirm-currency-payment').addEventListener('click', () => {
            this.confirmCurrencyPayment();
            modal.remove();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                this.multicurrencyState.showCurrencyInput = false;
            }
        });
        
        setTimeout(() => {
            input.focus();
            input.select();
        }, 100);
        
        input.dispatchEvent(new Event('input'));
    },

    async confirmCurrencyPayment() {
        const method = this.multicurrencyState.selectedMethod;
        const currencyAmount = this.multicurrencyState.currencyAmount;
        const convertedAmount = this.multicurrencyState.convertedAmount;
        const rate = this.multicurrencyState.exchangeRate;
        
        if (currencyAmount <= 0) {
            this.showError('Por favor ingrese un monto válido');
            return;
        }
        
        console.log(`[MultiCurrency Interface] Confirming payment:`, {
            method: method.name,
            currencyAmount: currencyAmount,
            convertedAmount: convertedAmount,
            rate: rate
        });
        
        try {
            const paymentLine = super.addNewPaymentLine(method);
            
            if (paymentLine) {
                if (typeof paymentLine.set_amount === 'function') {
                    paymentLine.set_amount(convertedAmount);
                } else {
                    paymentLine.amount = convertedAmount;
                    
                    if (typeof paymentLine.trigger === 'function') {
                        paymentLine.trigger('change:amount');
                    }
                }
                
                // ESTRATEGIA AGRESIVA: Almacenar en múltiples lugares
                
                // 1. En el payment line directamente
                paymentLine.is_multicurrency = true;
                paymentLine.payment_currency_id = method.payment_currency_id.id;
                paymentLine.payment_currency_amount = currencyAmount;
                paymentLine.payment_exchange_rate = rate;
                
                // 2. En la orden para sincronización
                const order = this.pos.get_order();
                if (order) {
                    // Inicializar array si no existe
                    if (!order.multicurrency_payments) {
                        order.multicurrency_payments = [];
                    }
                    
                    // Agregar datos multicurrency
                    order.multicurrency_payments.push({
                        payment_method_id: method.id,
                        payment_currency_id: method.payment_currency_id.id,
                        payment_currency_amount: currencyAmount,
                        payment_exchange_rate: rate,
                        amount: convertedAmount,
                        timestamp: Date.now()
                    });
                    
                    console.log('[DEBUG] Stored multicurrency data in order:', order.multicurrency_payments);
                }
                
                // 3. Hook del export_as_JSON si existe
                if (paymentLine.export_as_JSON) {
                    const originalExport = paymentLine.export_as_JSON;
                    paymentLine.export_as_JSON = function() {
                        const json = originalExport.call(this);
                        json.is_multicurrency = true;
                        json.payment_currency_id = method.payment_currency_id.id;
                        json.payment_currency_amount = currencyAmount;
                        json.payment_exchange_rate = rate;
                        console.log('[DEBUG] Enhanced export_as_JSON called:', json);
                        return json;
                    };
                }
                
                // 4. Intentar guardado inmediato si hay ID
                setTimeout(async () => {
                    try {
                        if (paymentLine.id) {
                            await this.pos.env.services.rpc({
                                model: 'pos.payment',
                                method: 'write',
                                args: [[paymentLine.id], {
                                    'payment_currency_id': method.payment_currency_id.id,
                                    'payment_amount_currency': currencyAmount,
                                    'payment_exchange_rate': rate,
                                }]
                            });
                            console.log('[DEBUG] Immediate RPC save successful');
                        }
                    } catch (e) {
                        console.log('[DEBUG] Immediate RPC save failed:', e);
                    }
                }, 1000);
                
                try {
                    const order = this.pos.get_order();
                    if (order) {
                        this.render();
                        this.env.bus.trigger('payment-line-added', paymentLine);
                        console.log('[MultiCurrency Interface] Order totals updated after payment');
                    }
                } catch (updateError) {
                    console.warn('[MultiCurrency Interface] Error updating totals:', updateError);
                    setTimeout(() => {
                        try {
                            this.render();
                        } catch (e) {
                            console.warn('Fallback render failed:', e);
                        }
                    }, 100);
                }
                
                console.log('[MultiCurrency Interface] Payment line created successfully:', paymentLine);
                this.showPaymentSuccess(method, currencyAmount, convertedAmount, rate);
                
            } else {
                console.error('[MultiCurrency Interface] Failed to create payment line');
                this.showError('Error al crear línea de pago');
            }
            
        } catch (error) {
            console.error('[MultiCurrency Interface] Error in confirmCurrencyPayment:', error);
            this.showError('Error al procesar el pago: ' + error.message);
        }
        
        this.multicurrencyState.showCurrencyInput = false;
    },

    showPaymentSuccess(method, currencyAmount, convertedAmount, rate) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(45deg, #28a745, #20c997);
            color: white;
            padding: 20px;
            border-radius: 10px;
            z-index: 999998;
            font-size: 16px;
            font-weight: bold;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            max-width: 300px;
        `;
        
        const currency = method.payment_currency_id;
        const baseCurrency = this.pos.config.currency_id || { symbol: '$' };
        
        notification.innerHTML = `
            <div style="font-size: 18px; margin-bottom: 8px;">Pago Multi-Currency Exitoso!</div>
            <div style="font-size: 14px; opacity: 0.9;">
                <div>${currency.symbol}${currencyAmount.toFixed(2)} ${currency.name}</div>
                <div>→ ${baseCurrency.symbol}${convertedAmount.toFixed(2)}</div>
                <div style="font-size: 12px; margin-top: 5px;">Tasa: ${rate.toFixed(4)}</div>
            </div>
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    },

    showError(message) {
        const error = document.createElement('div');
        error.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #dc3545;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 999999;
            font-weight: bold;
        `;
        
        error.textContent = message;
        document.body.appendChild(error);
        setTimeout(() => error.remove(), 3000);
    }
});

// Patch para el objeto Order usando el registry del POS
setTimeout(() => {
    try {
        // Acceder al Order model a través del POS
        const orderPrototype = window.odoo?.loader?.modules?.get('@point_of_sale/app/models')?.Order?.prototype;
        
        if (orderPrototype) {
            console.log('[DEBUG] Found Order prototype, patching export_as_JSON');
            
            const originalExportAsJSON = orderPrototype.export_as_JSON;
            orderPrototype.export_as_JSON = function() {
                const json = originalExportAsJSON.call(this);
                
                if (this.multicurrency_payments) {
                    json.multicurrency_payments = this.multicurrency_payments;
                    console.log('[DEBUG] Order JSON with multicurrency data:', json.multicurrency_payments);
                }
                
                return json;
            };
        } else {
            console.warn('[DEBUG] Could not find Order prototype for patching');
        }
    } catch (e) {
        console.error('[DEBUG] Error patching Order:', e);
    }
}, 2000);

console.log('[MultiCurrency Interface] Payment interface loaded');