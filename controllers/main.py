# -*- coding: utf-8 -*-
import logging
from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


class PosMultiCurrencyController(http.Controller):
    
    @http.route('/pos/refresh_exchange_rates', type='json', auth='user')
    def refresh_exchange_rates(self, config_id=None):
        """Refresh exchange rates for POS payment methods"""
        try:
            if not config_id:
                return {}
                
            pos_config = request.env['pos.config'].browse(config_id)
            if not pos_config.exists() or not pos_config.multi_currency_payments:
                return {}
                
            rates = {}
            for method in pos_config.payment_method_ids:
                if method.payment_currency_id:
                    # Calculate fresh exchange rate
                    rate = method.get_exchange_rate()
                    rates[method.id] = rate
                    
            return rates
            
        except Exception as e:
            _logger.warning("Error refreshing exchange rates: %s", e)
            return {}