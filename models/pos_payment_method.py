# -*- coding: utf-8 -*-
from odoo import fields, models, api, _


class PosPaymentMethod(models.Model):
    _inherit = 'pos.payment.method'
    
    payment_currency_id = fields.Many2one(
        'res.currency',
        string='Payment Currency',
        help='Currency for this payment method. Leave empty to use POS default currency'
    )
    
    exchange_rate_source = fields.Selection([
        ('auto', 'Automatic (Odoo Rates)'),
        ('manual', 'Manual Rate'),
    ], string='Exchange Rate Source', default='auto')
    
    manual_exchange_rate = fields.Float(
        string='Manual Exchange Rate',
        digits=(12, 6),
        default=1.0,
        help='Manual exchange rate (1 payment currency = X base currency)'
    )

    @api.model
    def _load_pos_data_fields(self, config_id):
        """Add new fields to POS frontend data"""
        fields = super()._load_pos_data_fields(config_id)
        fields.extend(['payment_currency_id', 'exchange_rate_source', 'manual_exchange_rate'])
        return fields

    def get_exchange_rate(self, date=None):
        """Get current exchange rate using Odoo native currency system"""
        self.ensure_one()
        
        if not self.payment_currency_id:
            return 1.0
            
        if self.exchange_rate_source == 'manual':
            return self.manual_exchange_rate
            
        # Usar sistema nativo de Odoo para tasas de cambio
        config = self.env.context.get('pos_config')
        if config:
            base_currency = config.base_currency_id
        else:
            base_currency = self.env.company.currency_id
            
        # Utilizar el método nativo de Odoo 18
        return self.payment_currency_id._get_conversion_rate(
            self.payment_currency_id,
            base_currency,
            self.env.company,
            date or fields.Date.today()
        )
