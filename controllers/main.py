# -*- coding: utf-8 -*-
import logging
from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


class PosMultiCurrencyController(http.Controller):
    
    @http.route('/pos/save_multicurrency_payment_temp', type='json', auth='user')
    def save_multicurrency_payment_temp(self, **kwargs):
        """Almacenar datos multicurrency temporalmente antes de sincronizar orden"""
        try:
            _logger.info(f"[MultiCurrency] Received temp payment data: {kwargs}")
            
            # Obtener datos desde kwargs o params
            payment_data = kwargs if kwargs else request.jsonrequest.get('params', {})
            
            # Validar datos requeridos
            required_fields = ['payment_method_id', 'payment_currency_id', 
                             'payment_currency_amount', 'payment_exchange_rate']
            
            for field in required_fields:
                if field not in payment_data:
                    return {'success': False, 'error': f'Missing field: {field}'}
            
            # Obtener orden actual desde el contexto del POS
            # En lugar de usar order ID (que aún no existe), usar el UUID de orden
            order_uuid = payment_data.get('order_uuid')
            if not order_uuid:
                # Intentar obtener desde contexto o generar temporal
                order_uuid = f"temp_{payment_data['payment_method_id']}_{payment_data['payment_currency_id']}"
            
            # Almacenar datos temporalmente
            pos_order = request.env['pos.order']
            result = pos_order.store_multicurrency_temp(order_uuid, {
                'payment_method_id': payment_data['payment_method_id'],
                'payment_currency_id': payment_data['payment_currency_id'],
                'payment_currency_amount': payment_data['payment_currency_amount'],
                'payment_exchange_rate': payment_data['payment_exchange_rate'],
            })
            
            if result:
                return {'success': True, 'message': 'Multicurrency data stored temporarily'}
            else:
                return {'success': False, 'error': 'Failed to store data'}
                
        except Exception as e:
            _logger.error(f"[MultiCurrency] Error storing temp payment data: {e}")
            return {'success': False, 'error': str(e)}
    
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

    @http.route('/pos/save_multicurrency_payment', type='json', auth='user')
    def save_multicurrency_payment(self, payment_data):
        """Save multicurrency payment with original currency amounts"""
        try:
            payment = request.env['pos.payment'].browse(payment_data['id'])
            if payment.exists():
                payment.write({
                    'payment_currency_id': payment_data.get('payment_currency_id'),
                    'payment_amount_currency': payment_data.get('payment_amount_currency'),
                    'payment_exchange_rate': payment_data.get('payment_exchange_rate'),
                })
                return {'success': True}
            return {'success': False, 'error': 'Payment not found'}
        except Exception as e:
            return {'success': False, 'error': str(e)}