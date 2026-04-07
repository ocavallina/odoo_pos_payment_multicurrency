# -*- coding: utf-8 -*-
import logging
from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


class PosMultiCurrencyController(http.Controller):

    @http.route('/pos/save_multicurrency_payment_temp', type='jsonrpc', auth='user')
    def save_multicurrency_payment_temp(self, **kwargs):
        """Store multicurrency data temporarily before order sync"""
        try:
            payment_data = kwargs if kwargs else request.jsonrequest.get('params', {})

            required_fields = [
                'payment_method_id', 'payment_currency_id',
                'payment_currency_amount', 'payment_exchange_rate',
            ]
            for field in required_fields:
                if field not in payment_data:
                    return {'success': False, 'error': f'Missing field: {field}'}

            order_uuid = payment_data.get('order_uuid')
            if not order_uuid:
                order_uuid = f"temp_{payment_data['payment_method_id']}_{payment_data['payment_currency_id']}"

            result = request.env['pos.order'].store_multicurrency_temp(order_uuid, {
                'payment_method_id': payment_data['payment_method_id'],
                'payment_currency_id': payment_data['payment_currency_id'],
                'payment_currency_amount': payment_data['payment_currency_amount'],
                'payment_exchange_rate': payment_data['payment_exchange_rate'],
            })

            if result:
                return {'success': True, 'message': 'Multicurrency data stored'}
            return {'success': False, 'error': 'Failed to store data'}

        except Exception as e:
            _logger.error("Error storing multicurrency temp data: %s", e)
            return {'success': False, 'error': str(e)}

    @http.route('/pos/get_multicurrency_methods', type='jsonrpc', auth='user')
    def get_multicurrency_methods(self, config_id):
        """Get currency metadata for payment methods (Many2one data not available via _load_pos_data_fields)"""
        try:
            config = request.env['pos.config'].browse(config_id)
            if not config.exists() or not config.multi_currency_payments:
                return {'success': False, 'error': 'Multi-currency not enabled'}

            result = {}
            for method in config.payment_method_ids:
                if method.payment_currency_id:
                    result[method.id] = {
                        'currency_id': method.payment_currency_id.id,
                        'currency_name': method.payment_currency_id.name,
                        'currency_symbol': method.payment_currency_id.symbol,
                    }

            return {'success': True, 'methods': result}

        except Exception as e:
            _logger.error("Error in get_multicurrency_methods: %s", e)
            return {'success': False, 'error': str(e)}

    @http.route('/pos/refresh_exchange_rates', type='jsonrpc', auth='user')
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
                rate = method.get_exchange_rate()
                rates[method.id] = {
                    'rate': rate,
                    'currency': method.payment_currency_id.read(['id', 'name', 'symbol'])[0],
                    'base_currency': base_currency.read(['id', 'name', 'symbol'])[0] if base_currency else None,
                }

            return {'success': True, 'rates': rates}

        except Exception as e:
            _logger.warning("Error refreshing exchange rates: %s", e)
            return {'success': False, 'error': str(e)}

    @http.route('/pos/save_multicurrency_payment', type='jsonrpc', auth='user')
    def save_multicurrency_payment(self, payment_data):
        """Save multicurrency payment data directly to pos.payment"""
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
            _logger.error("Error saving multicurrency payment: %s", e)
            return {'success': False, 'error': str(e)}
