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

    // Override del método de agregar línea de pago
    addNewPaymentLine(paymentMethod) {
        console.log(`[MultiCurrency Interface] Adding payment: ${paymentMethod.name}`);
        
        // Si es un método con moneda extranjera, mostrar interfaz especial
        if (paymentMethod.payment_currency_id) {
            console.log(`[MultiCurrency Interface] Foreign currency method: ${paymentMethod.payment_currency_id.name}`);
            this.showMultiCurrencyInterface(paymentMethod);
            return; // No crear la línea de pago todavía
        }
        
        // Si es método normal, proceder normalmente
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
        
        // Crear modal
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
        
        // Pendiente de la orden - usando métodos seguros
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
            pendingAmount = 100; // Valor por defecto
        }
        
        const suggestedForeignAmount = (pendingAmount / rate).toFixed(2);
        
        // Función para formatear moneda compatible con Odoo 18
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
        
        // Event listeners
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
        
        // Cerrar modal al hacer click fuera
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                this.multicurrencyState.showCurrencyInput = false;
            }
        });
        
        // Focus en input y seleccionar texto
        setTimeout(() => {
            input.focus();
            input.select();
        }, 100);
        
        // Trigger inicial del cálculo
        input.dispatchEvent(new Event('input'));
    },

    confirmCurrencyPayment() {
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
            // Crear línea de pago con datos multicurrency
            const paymentLine = super.addNewPaymentLine(method);
            
            if (paymentLine) {
                // Establecer el monto convertido - Odoo 18 compatible
                if (typeof paymentLine.set_amount === 'function') {
                    paymentLine.set_amount(convertedAmount);
                } else {
                    // Fallback para diferentes versiones de Odoo
                    paymentLine.amount = convertedAmount;
                    
                    // Trigger update si existe
                    if (typeof paymentLine.trigger === 'function') {
                        paymentLine.trigger('change:amount');
                    }
                }
                
                // Guardar datos de multicurrency para el backend
                Object.assign(paymentLine, {
                    payment_currency_amount: currencyAmount,
                    payment_exchange_rate: rate,
                    payment_currency_id: method.payment_currency_id,
                    is_multicurrency: true,
                    original_currency_name: method.payment_currency_id.name,
                    // Datos para envío al backend
                    payment_method_id: method.id,
                    currency_id: method.payment_currency_id.id,
                });
                
                // Fix 1: Forzar actualización del balance pendiente
                try {
                    const order = this.pos.get_order();
                    if (order) {
                        // Odoo 18 compatible - forzar re-render directo
                        this.render();
                        
                        // Dispatch evento personalizado para actualizar componentes
                        this.env.bus.trigger('payment-line-added', paymentLine);
                        
                        console.log('[MultiCurrency Interface] Order totals updated after payment');
                    }
                } catch (updateError) {
                    console.warn('[MultiCurrency Interface] Error updating totals:', updateError);
                    // Fallback: forzar re-render después de timeout
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

console.log('[MultiCurrency Interface] Payment interface loaded');