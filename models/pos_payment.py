# -*- coding: utf-8 -*-
from odoo import fields, models, api


class PosPayment(models.Model):
    _inherit = 'pos.payment'
    
    payment_currency_id = fields.Many2one(
        'res.currency',
        string='Payment Currency',
        help='Original currency of the payment'
    )
    
    payment_amount = fields.Monetary(
        string='Payment Amount',
        currency_field='payment_currency_id',
        help='Amount in payment currency'
    )
    
    payment_exchange_rate = fields.Float(
        string='Exchange Rate Used',
        digits=(12, 6),
        default=1.0,
        help='Exchange rate used for this payment'
    )

    @api.model_create_multi
    def create(self, vals_list):
        """Set payment currency data on creation"""
        for vals in vals_list:
            payment_method = self.env['pos.payment.method'].browse(vals.get('payment_method_id'))
            if payment_method.payment_currency_id:
                vals['payment_currency_id'] = payment_method.payment_currency_id.id
                if 'payment_amount' not in vals:
                    vals['payment_amount'] = vals.get('amount', 0)
                vals['payment_exchange_rate'] = payment_method.get_exchange_rate()
        return super().create(vals_list)
