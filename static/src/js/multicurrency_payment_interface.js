/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { useState } from "@odoo/owl";

console.log('[MultiCurrency Interface] Loading fixed payment interface...');

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
            // CORRECCIÓN: addNewPaymentLine devuelve boolean, debemos obtener el payment desde la orden
            const paymentCreated = await super.addNewPaymentLine(method);
            console.log('[MultiCurrency] Payment creation result:', paymentCreated);
            
            if (paymentCreated) {
                // Obtener el payment line recién creado desde la orden
                const order = this.pos.get_order();
                
                // DEBUG: Mostrar estructura completa de la orden
                console.log('[MultiCurrency DEBUG] Order object structure:');
                console.log('  - Order keys:', Object.keys(order));
                console.log('  - Order prototype:', Object.getPrototypeOf(order));
                console.log('  - Payment-related properties:', Object.keys(order).filter(k => k.toLowerCase().includes('payment')));
                
                // Intentar diferentes formas de acceder a payment lines
                let paymentLines = null;
                if (order.payment_ids) {
                    paymentLines = order.payment_ids;
                    console.log('[MultiCurrency] Using order.payment_ids');
                } else if (order.paymentlines) {
                    paymentLines = order.paymentlines;
                    console.log('[MultiCurrency] Using order.paymentlines');
                } else if (order.get_paymentlines) {
                    try {
                        paymentLines = order.get_paymentlines();
                        console.log('[MultiCurrency] Using order.get_paymentlines()');
                    } catch (e) {
                        console.log('[MultiCurrency] get_paymentlines() failed:', e);
                    }
                } else {
                    console.error('[MultiCurrency] Cannot find payment lines in order:', Object.keys(order));
                    this.showError('No se pudo acceder a las líneas de pago');
                    return;
                }
                
                console.log('[MultiCurrency] Payment lines found:', paymentLines);
                console.log('[MultiCurrency] Payment lines type:', typeof paymentLines);
                console.log('[MultiCurrency] Payment lines length/size:', paymentLines?.length || paymentLines?.size || 'unknown');
                
                // Buscar el último payment line del método específico
                let paymentLine = null;
                if (Array.isArray(paymentLines)) {
                    for (let i = paymentLines.length - 1; i >= 0; i--) {
                        if (paymentLines[i].payment_method_id.id === method.id) {
                            paymentLine = paymentLines[i];
                            break;
                        }
                    }
                } else if (paymentLines && paymentLines.models) {
                    // Si es una colección
                    const paymentsArray = paymentLines.models;
                    for (let i = paymentsArray.length - 1; i >= 0; i--) {
                        if (paymentsArray[i].payment_method_id.id === method.id) {
                            paymentLine = paymentsArray[i];
                            break;
                        }
                    }
                } else if (paymentLines && typeof paymentLines.forEach === 'function') {
                    // Si tiene forEach (colección iterable)
                    let lastPayment = null;
                    paymentLines.forEach(payment => {
                        if (payment.payment_method_id.id === method.id) {
                            lastPayment = payment;
                        }
                    });
                    paymentLine = lastPayment;
                }
                
                    console.log('[MultiCurrency] Found payment line:', paymentLine);
                    
                    // DEBUG: Forzar export_as_JSON inmediatamente para ver si funciona
                    if (paymentLine.export_as_JSON) {
                        console.log('[MultiCurrency] Testing export_as_JSON before override...');
                        const originalJson = paymentLine.export_as_JSON();
                        console.log('[MultiCurrency] Original JSON:', originalJson);
                    }
                
                if (paymentLine) {
                    // Configurar monto base
                    if (typeof paymentLine.set_amount === 'function') {
                        paymentLine.set_amount(convertedAmount);
                    } else {
                        paymentLine.amount = convertedAmount;
                    }
                    
                    // NUEVA ESTRATEGIA: Almacenar multicurrency en el export_as_JSON
                    const originalExportAsJSON = paymentLine.export_as_JSON;
                    paymentLine.export_as_JSON = function() {
                        console.log('[MultiCurrency] 🔥 export_as_JSON CALLED!');
                        
                        const json = originalExportAsJSON ? originalExportAsJSON.call(this) : {
                            name: this.name || 'Payment',
                            amount: this.amount || 0,
                            payment_method_id: method.id,
                            payment_date: new Date().toISOString()
                        };
                        
                        // AGREGAR DATOS MULTICURRENCY AL JSON DEL PAYMENT
                        json.is_multicurrency = true;
                        json.payment_currency_id = method.payment_currency_id.id;
                        json.payment_currency_amount = currencyAmount;
                        json.payment_exchange_rate = rate;
                        
                        console.log('[MultiCurrency] ✅ Payment export_as_JSON with multicurrency data:');
                        console.log('  - Currency ID:', json.payment_currency_id);
                        console.log('  - Currency Amount:', json.payment_currency_amount);
                        console.log('  - Exchange Rate:', json.payment_exchange_rate);
                        console.log('  - Base Amount:', json.amount);
                        console.log('[MultiCurrency] 📤 SENDING TO BACKEND:', json);
                        
                        return json;
                    };
                    
                    // DEBUG: Verificar que el override funciona
                    setTimeout(() => {
                        console.log('[MultiCurrency] Testing enhanced export_as_JSON after 1 second...');
                        if (paymentLine.export_as_JSON) {
                            const testJson = paymentLine.export_as_JSON();
                            console.log('[MultiCurrency] Enhanced JSON test:', testJson);
                        }
                    }, 1000);
                    
                    // NUEVA ESTRATEGIA: Envío directo al backend via HTTP
                    setTimeout(async () => {
                        try {
                            console.log('[MultiCurrency] 🚀 Sending multicurrency data directly to backend...');
                            
                            // Obtener UUID de la orden actual
                            const order = this.pos.get_order();
                            const orderUuid = order ? (order.uuid || order.uid || `temp_${Date.now()}`) : `temp_${Date.now()}`;
                            
                            const multicurrencyData = {
                                order_uuid: orderUuid,
                                payment_method_id: method.id,
                                payment_currency_id: method.payment_currency_id.id,
                                payment_currency_amount: currencyAmount,
                                payment_exchange_rate: rate,
                                base_amount: convertedAmount
                            };
                            
                            console.log('[MultiCurrency] Sending data:', multicurrencyData);
                            
                            // Usar fetch directamente como alternativa más compatible
                            const response = await fetch('/pos/save_multicurrency_payment_temp', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    jsonrpc: '2.0',
                                    method: 'call',
                                    params: multicurrencyData,
                                    id: Date.now()
                                })
                            });
                            
                            const data = await response.json();
                            const result = data.result;
                            
                            if (result && result.success) {
                                console.log('[MultiCurrency] ✅ Multicurrency data sent successfully via HTTP');
                                this.showBackendSuccess();
                            } else {
                                console.log('[MultiCurrency] ❌ Failed to send multicurrency data:', result?.error || 'Unknown error');
                                this.showBackendError(result?.error || 'Unknown error');
                            }
                            
                        } catch (error) {
                            console.error('[MultiCurrency] Error sending multicurrency data:', error);
                            this.showBackendError(error.message);
                        }
                    }, 2000);
                    
                    // Refresh UI
                    this.render();
                    
                    console.log('[MultiCurrency Interface] Payment line enhanced successfully:', paymentLine);
                    this.showPaymentSuccess(method, currencyAmount, convertedAmount, rate);
                    
                } else {
                    console.error('[MultiCurrency Interface] Could not find created payment line');
                    this.showError('No se pudo encontrar la línea de pago creada');
                }
            } else {
                console.error('[MultiCurrency Interface] Payment creation failed');
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
    },

    showBackendSuccess() {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            background: linear-gradient(45deg, #4CAF50, #8BC34A);
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            z-index: 999997;
            font-size: 14px;
            font-weight: bold;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        
        notification.innerHTML = `
            <div>Datos Multi-Currency enviados al Backend</div>
            <div style="font-size: 12px; margin-top: 5px; opacity: 0.9;">Los campos se guardarán al finalizar la orden</div>
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 4000);
    },

    showBackendError(error) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            background: #FF5722;
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            z-index: 999997;
            font-size: 14px;
            font-weight: bold;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        
        notification.innerHTML = `
            <div>Error enviando datos Multi-Currency</div>
            <div style="font-size: 12px; margin-top: 5px; opacity: 0.9;">${error}</div>
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    }
});

console.log('[MultiCurrency Interface] Fixed payment interface loaded');