# -*- coding: utf-8 -*-
from odoo import fields, models, api


class PosPayment(models.Model):
    _inherit = 'pos.payment'
    
    payment_currency_id = fields.Many2one(
        'res.currency',
        string='Payment Currency',
        help='Original currency of the payment'
    )
    
    payment_amount_currency = fields.Monetary(
        string='Amount in Payment Currency',
        currency_field='payment_currency_id',
        help='Amount entered in the payment currency (e.g. USD)'
    )
    
    payment_exchange_rate = fields.Float(
        string='Exchange Rate Used',
        digits=(12, 6),
        default=1.0,
        help='Exchange rate used for this payment (1 payment currency = X base currency)'
    )

    def _export_for_ui(self):
        """Export multicurrency data to frontend"""
        result = super()._export_for_ui()
        
        if self.payment_currency_id:
            result.update({
                'is_multicurrency': True,
                'payment_currency_id': self.payment_currency_id.id,
                'payment_currency_name': self.payment_currency_id.name,
                'payment_amount_currency': self.payment_amount_currency,
                'payment_exchange_rate': self.payment_exchange_rate,
            })
        
        return result

    @api.model
    def create_from_ui(self, payments, session_id):
        """Override to handle multicurrency data from frontend"""
        result = super().create_from_ui(payments, session_id)
        
        # Process multicurrency payments
        for payment_data in payments:
            if payment_data.get('is_multicurrency'):
                try:
                    payment = self.browse(payment_data.get('id'))
                    if payment.exists():
                        payment.write({
                            'payment_currency_id': payment_data.get('payment_currency_id'),
                            'payment_amount_currency': payment_data.get('payment_currency_amount'),
                            'payment_exchange_rate': payment_data.get('payment_exchange_rate'),
                        })
                except Exception as e:
                    import logging
                    _logger = logging.getLogger(__name__)
                    _logger.error(f"Error saving multicurrency payment data: {e}")
        
        return result