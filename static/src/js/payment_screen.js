/** @odoo-module */

import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { patch } from "@web/core/utils/patch";

patch(PaymentScreen.prototype, {
    
    setup() {
        super.setup();
        this.multicurrency = this.pos?.config?.multi_currency_payments || false;
    },
    
    getPaymentMethodCurrencyInfo(paymentMethod) {
        if (!this.multicurrency || !paymentMethod?.payment_currency_id) {
            return '';
        }
        
        const currency = paymentMethod.payment_currency_id;
        const baseCurrency = this.pos?.config?.base_currency_id || this.pos?.currency;
        
        if (!currency || !baseCurrency || currency.id === baseCurrency.id) {
            return '';
        }
        
        return `(${currency.symbol || currency.name})`;
    },
    
    getSelectedPaymentLineInfo() {
        if (!this.multicurrency) return null;
        
        const line = this.paymentLines?.find(line => line.selected);
        if (!line) return null;
        
        try {
            const paymentCurrency = line.getPaymentCurrency();
            const baseCurrency = this.pos?.config?.base_currency_id || this.pos?.currency;
            
            if (!paymentCurrency || !baseCurrency || paymentCurrency.id === baseCurrency.id) {
                return null;
            }
            
            const rate = line.getExchangeRate();
            const paymentAmount = line.convertToPaymentCurrency(line.amount || 0);
            
            return {
                baseCurrency: baseCurrency,
                paymentCurrency: paymentCurrency,
                exchangeRate: rate,
                baseAmount: this.env?.utils?.formatCurrency ? 
                    this.env.utils.formatCurrency(line.amount || 0) : 
                    `${(line.amount || 0).toFixed(2)}`,
                paymentAmount: this.env?.utils?.formatCurrency ? 
                    this.env.utils.formatCurrency(paymentAmount, paymentCurrency) :
                    `${paymentAmount.toFixed(2)}`
            };
        } catch (error) {
            console.warn('[MultiCurrency] Error getting payment line info:', error);
            return null;
        }
    },
    
    // Override addNewPaymentLine to handle multi-currency
    addNewPaymentLine(paymentMethod) {
        try {
            // Call parent method
            const result = super.addNewPaymentLine(paymentMethod);
            
            // Add currency information if multi-currency is enabled
            if (this.multicurrency && paymentMethod?.payment_currency_id) {
                console.log(`[MultiCurrency] Adding payment with currency: ${paymentMethod.payment_currency_id.name}`);
            }
            
            return result;
        } catch (error) {
            console.warn('[MultiCurrency] Error in addNewPaymentLine:', error);
            // Fallback to parent method
            return super.addNewPaymentLine(paymentMethod);
        }
    },
    
    // Method to refresh exchange rates
    async refreshExchangeRates() {
        if (!this.multicurrency) return;
        
        try {
            // This would call backend to get fresh rates
            const rates = await this.rpc('/pos/refresh_exchange_rates', {
                config_id: this.pos.config.id
            });
            
            // Update rates in payment methods
            if (rates) {
                for (const method of this.pos.models['pos.payment.method'].getAll()) {
                    if (method.payment_currency_id && rates[method.id]) {
                        method.current_exchange_rate = rates[method.id];
                    }
                }
            }
        } catch (error) {
            console.warn('[MultiCurrency] Could not refresh exchange rates:', error);
        }
    }
});