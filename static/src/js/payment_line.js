/** @odoo-module */

import { PosPaymentLine } from "@point_of_sale/app/models/pos_payment_line";
import { patch } from "@web/core/utils/patch";

patch(PosPaymentLine.prototype, {
    
    getPaymentCurrency() {
        return this.payment_method_id.payment_currency_id || this.pos.currency;
    },
    
    getExchangeRate() {
        if (!this.payment_method_id.payment_currency_id) {
            return 1.0;
        }
        
        if (this.payment_method_id.exchange_rate_source === 'manual') {
            return this.payment_method_id.manual_exchange_rate || 1.0;
        }
        
        // Usar tasas de Odoo - se calculará en el backend
        return this.payment_method_id.current_exchange_rate || 1.0;
    },
    
    convertToPaymentCurrency(baseAmount) {
        const rate = this.getExchangeRate();
        return baseAmount / rate;
    },
    
    convertFromPaymentCurrency(paymentAmount) {
        const rate = this.getExchangeRate();
        return paymentAmount * rate;
    },
    
    getFormattedPaymentAmount() {
        const paymentCurrency = this.getPaymentCurrency();
        const amount = this.convertToPaymentCurrency(this.amount);
        
        return this.env.utils.formatCurrency(amount, paymentCurrency);
    }
});
