# -*- coding: utf-8 -*-
from odoo import fields, models, api, _
from odoo.exceptions import ValidationError


class PosConfig(models.Model):
    _inherit = 'pos.config'
    
    multi_currency_payments = fields.Boolean(
        string='Multi-Currency Payments',
        default=False,
        help='Allow payments in different currencies for this POS'
    )
    
    base_currency_id = fields.Many2one(
        'res.currency',
        string='Base Currency',
        default=lambda self: self.env.company.currency_id,
        help='Base currency for exchange rate calculations'
    )

    @api.onchange('multi_currency_payments')
    def _onchange_multi_currency_payments(self):
        """Set base currency when enabling multi-currency"""
        if self.multi_currency_payments and not self.base_currency_id:
            self.base_currency_id = self.env.company.currency_id

    @api.constrains('multi_currency_payments', 'base_currency_id', 'payment_method_ids')
    def _check_multicurrency_configuration(self):
        """Validate multi-currency configuration"""
        for config in self:
            if config.multi_currency_payments:
                # Base currency debe estar definida
                if not config.base_currency_id:
                    raise ValidationError(_("Base Currency is required when Multi-Currency Payments is enabled."))
                
                # Base currency debe estar activa
                if not config.base_currency_id.active:
                    raise ValidationError(_("Base Currency must be active."))
                
                # Validar payment methods con currencies
                for pm in config.payment_method_ids:
                    if pm.payment_currency_id:
                        # Currency del payment method debe estar activa
                        if not pm.payment_currency_id.active:
                            raise ValidationError(
                                _("Payment method '%s' uses inactive currency '%s'. "
                                  "Please activate the currency or remove it from the payment method.") % 
                                (pm.name, pm.payment_currency_id.name)
                            )
                        
                        # Validar manual exchange rate
                        if pm.exchange_rate_source == 'manual' and pm.manual_exchange_rate <= 0:
                            raise ValidationError(
                                _("Payment method '%s' has invalid manual exchange rate. "
                                  "Exchange rate must be greater than 0.") % pm.name
                            )

    def write(self, vals):
        """Override write to handle currency changes"""
        result = super().write(vals)
        
        # Si se desactiva multi-currency, limpiar configuraciones relacionadas
        if 'multi_currency_payments' in vals and not vals['multi_currency_payments']:
            for config in self:
                # Limpiar currency específica de payment methods
                config.payment_method_ids.write({
                    'payment_currency_id': False,
                    'exchange_rate_source': 'auto',
                    'manual_exchange_rate': 1.0
                })
        
        return result