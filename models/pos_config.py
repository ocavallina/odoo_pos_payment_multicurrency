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

    @api.constrains('pricelist_id', 'use_pricelist', 'available_pricelist_ids', 
                    'journal_id', 'invoice_journal_id', 'payment_method_ids')
    def _check_currencies(self):
        """Override currency validation to allow multi-currency when enabled"""
        for config in self:
            if not config.multi_currency_payments:
                super()._check_currencies()
                continue
                
            # Validaciones para multi-currency
            if config.use_pricelist and config.pricelist_id and config.pricelist_id not in config.available_pricelist_ids:
                raise ValidationError(_("The default pricelist must be included in the available pricelists."))

            # Validar que las monedas de pago estén activas
            for pm in config.payment_method_ids:
                if (pm.payment_currency_id and 
                    pm.payment_currency_id != config.currency_id and
                    not pm.payment_currency_id.active):
                    raise ValidationError(
                        _("Payment method '%s' uses inactive currency '%s'") % 
                        (pm.name, pm.payment_currency_id.name)
                    )
