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
    
    # Campo computado para el frontend
    current_exchange_rate = fields.Float(
        string='Current Exchange Rate',
        compute='_compute_current_exchange_rate',
        digits=(12, 6),
        help='Current exchange rate for frontend use'
    )

    @api.depends('payment_currency_id', 'exchange_rate_source', 'manual_exchange_rate')
    def _compute_current_exchange_rate(self):
        """Compute current exchange rate for frontend"""
        for record in self:
            record.current_exchange_rate = record.get_exchange_rate()

    @api.model
    def _load_pos_data_fields(self, config_id):
        """Add new fields to POS frontend data"""
        fields = super()._load_pos_data_fields(config_id)
        
        # Añadir los nuevos campos para multi-currency
        multicurrency_fields = [
            'payment_currency_id', 
            'exchange_rate_source', 
            'manual_exchange_rate',
            'current_exchange_rate'
        ]
        
        # Evitar duplicados y añadir solo los campos que no existen
        for field in multicurrency_fields:
            if field not in fields:
                fields.append(field)
                
        return fields

    def get_exchange_rate(self, date=None):
        """Get current exchange rate using Odoo native currency system"""
        self.ensure_one()
        
        if not self.payment_currency_id:
            return 1.0
            
        if self.exchange_rate_source == 'manual':
            return self.manual_exchange_rate
            
        # Usar sistema nativo de Odoo para tasas de cambio
        # Buscar config desde el contexto o usar company currency como fallback
        base_currency = self.env.company.currency_id
        
        # Intentar obtener la currency base desde pos.config si está disponible
        if hasattr(self, '_context') and self._context.get('pos_config_id'):
            pos_config = self.env['pos.config'].browse(self._context.get('pos_config_id'))
            if pos_config.exists() and pos_config.base_currency_id:
                base_currency = pos_config.base_currency_id
                
        # Si las currencies son iguales, no hay conversión
        if self.payment_currency_id.id == base_currency.id:
            return 1.0
            
        # Utilizar el método nativo de Odoo 18
        try:
            return self.payment_currency_id._get_conversion_rate(
                self.payment_currency_id,
                base_currency,
                self.env.company,
                date or fields.Date.today()
            )
        except:
            # Fallback si hay problemas con el rate
            return 1.0

    @api.depends('name', 'payment_currency_id', 'current_exchange_rate')
    def _compute_display_name(self):
        """Override to show currency in display name"""
        for method in self:
            if method.payment_currency_id:
                currency_info = f" ({method.payment_currency_id.name})"
                if method.current_exchange_rate != 1.0:
                    currency_info += f" - {method.current_exchange_rate:.4f}"
                method.display_name = method.name + currency_info
            else:
                method.display_name = method.name

    display_name = fields.Char(compute='_compute_display_name', store=False)