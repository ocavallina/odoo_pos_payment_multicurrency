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
                return {'success': False, 'error': 'Config ID required'}
                
            pos_config = request.env['pos.config'].browse(config_id)
            if not pos_config.exists() or not pos_config.multi_currency_payments:
                return {'success': False, 'error': 'Multi-currency not enabled'}
                
            rates = {}
            base_currency = pos_config.base_currency_id
            
            for method in pos_config.payment_method_ids.filtered('payment_currency_id'):
                # Calculate fresh exchange rate
                rate = method.get_exchange_rate()
                rates[method.id] = {
                    'rate': rate,
                    'currency': method.payment_currency_id.read(['id', 'name', 'symbol'])[0] if method.payment_currency_id else None,
                    'base_currency': base_currency.read(['id', 'name', 'symbol'])[0] if base_currency else None
                }
                    
            return {'success': True, 'rates': rates}
            
        except Exception as e:
            _logger.warning("Error refreshing exchange rates: %s", e)
            return {'success': False, 'error': str(e)}

        
    @http.route('/pos/get_payment_methods_with_currency', type='json', auth='user')
    def get_payment_methods_with_currency(self, config_id):
        # Obtener datos directamente sin depender del sistema de carga del POS
        pos_config = request.env['pos.config'].browse(config_id)
        if not pos_config.exists() or not pos_config.multi_currency_payments:
            return {'success': False, 'error': 'Multi-currency not enabled'}
            
        methods = []
        for method in pos_config.payment_method_ids.filtered('payment_currency_id'):
            methods.append({
                'id': method.id,
                'name': method.name,
                'payment_currency_id': method.payment_currency_id.id if method.payment_currency_id else None,
                'current_exchange_rate': method.current_exchange_rate,
            })
            
        return {'success': True, 'methods': methods}

    @http.route('/pos/get_multicurrency_methods', type='json', auth='user')
    def get_multicurrency_methods(self, config_id):
        """Get payment methods with multicurrency data - BYPASS POS loading"""
        try:
            config = request.env['pos.config'].browse(config_id)
            methods = request.env['pos.payment.method'].search([
                ('id', 'in', config.payment_method_ids.ids)
            ])
            
            result = {}
            for method in methods:
                result[method.id] = {
                    'id': method.id,
                    'name': method.name,
                    'payment_currency_id': method.payment_currency_id.read(['id', 'name', 'symbol'])[0] if method.payment_currency_id else None,
                    'exchange_rate_source': method.exchange_rate_source,
                    'manual_exchange_rate': method.manual_exchange_rate,
                    'current_exchange_rate': method.get_exchange_rate(),
                }
            
            return {'success': True, 'methods': result}
            
        except Exception as e:
            import logging
            _logger = logging.getLogger(__name__)
            _logger.error(f"Error in get_multicurrency_methods: {e}")
            return {'success': False, 'error': str(e)}