/** @odoo-module */

import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { patch } from "@web/core/utils/patch";

patch(PaymentScreen.prototype, {
    
    setup() {
        super.setup();
        this.multicurrency = this.pos.config.multi_currency_payments;
    },
    
    getPaymentMethodCurrencyInfo(paymentMethod) {
        if (!this.multicurrency || !paymentMethod.payment_currency_id) {
            return '';
        }
        
        const currency = paymentMethod.payment_currency_id;
        const baseCurrency = this.pos.config.base_currency_id;
        
        if (currency.id === baseCurrency.id) {
            return '';
        }
        
        return `(${currency.symbol || currency.name})`;
    },
    
    getSelectedPaymentLineInfo() {
        const line = this.paymentLines.find(line => line.selected);
        if (!line || !this.multicurrency) {
            return null;
        }
        
        const paymentCurrency = line.getPaymentCurrency();
        const baseCurrency = this.pos.config.base_currency_id;
        
        if (paymentCurrency.id === baseCurrency.id) {
            return null;
        }
        
        const rate = line.getExchangeRate();
        const paymentAmount = line.convertToPaymentCurrency(line.amount);
        
        return {
            baseCurrency: baseCurrency,
            paymentCurrency: paymentCurrency,
            exchangeRate: rate,
            baseAmount: this.env.utils.formatCurrency(line.amount),
            paymentAmount: this.env.utils.formatCurrency(paymentAmount, paymentCurrency)
        };
    }
});
