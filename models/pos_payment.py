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
        help='Exchange rate used for this payment (1 payment currency = X base currency)'
    )