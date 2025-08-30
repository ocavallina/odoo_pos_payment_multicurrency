# -*- coding: utf-8 -*-
from odoo import models, fields, api
import logging

_logger = logging.getLogger(__name__)

class PosOrder(models.Model):
    _inherit = 'pos.order'

    @api.model
    def _process_order(self, order, existing_order):
        """Hook principal para procesar datos multicurrency de la orden completa"""
        _logger.info("[MultiCurrency Order] Processing complete order")
        
        pos_order = super()._process_order(order, existing_order)
        
        if isinstance(order, dict) and 'multicurrency_payments' in order:
            multicurrency_data = order['multicurrency_payments']
            _logger.info(f"[MultiCurrency Order] Found {len(multicurrency_data)} multicurrency payments")
            
            for mc_payment in multicurrency_data:
                try:
                    # Buscar payment por método y monto
                    matching_payments = pos_order.payment_ids.filtered(
                        lambda p: p.payment_method_id.id == mc_payment['payment_method_id'] 
                        and abs(p.amount - mc_payment['amount']) < 0.01
                    )
                    
                    if matching_payments:
                        payment = matching_payments[0]
                        payment.write({
                            'payment_currency_id': mc_payment['payment_currency_id'],
                            'payment_amount_currency': mc_payment['payment_currency_amount'],
                            'payment_exchange_rate': mc_payment['payment_exchange_rate'],
                        })
                        
                        _logger.info(f"[MultiCurrency Order] Updated payment {payment.id}")
                    else:
                        _logger.warning(f"[MultiCurrency Order] No matching payment found")
                        
                except Exception as e:
                    _logger.error(f"[MultiCurrency Order] Error: {e}")
        
        return pos_order

    @api.model
    def _process_payment_lines(self, pos_order, order, pos_session, draft):
        """Hook secundario para procesar líneas de pago"""
        _logger.info(f"[MultiCurrency Payment Lines] Processing payment lines")
        payments = super()._process_payment_lines(pos_order, order, pos_session, draft)
        
        if isinstance(order, dict):
            payment_data_list = order.get('statement_ids', [])
            
            for payment_data in payment_data_list:
                if len(payment_data) >= 3 and isinstance(payment_data[2], dict):
                    frontend_data = payment_data[2]
                    
                    if frontend_data.get('is_multicurrency'):
                        _logger.info("[MultiCurrency Payment Lines] Processing multicurrency data")
                        
                        try:
                            payment = None
                            payment_method_id = frontend_data.get('payment_method_id')
                            
                            for p in payments:
                                if p.payment_method_id.id == payment_method_id:
                                    payment = p
                                    break
                            
                            if payment:
                                payment.write({
                                    'payment_currency_id': frontend_data.get('payment_currency_id'),
                                    'payment_amount_currency': frontend_data.get('payment_currency_amount'),
                                    'payment_exchange_rate': frontend_data.get('payment_exchange_rate'),
                                })
                                _logger.info(f"[MultiCurrency Payment Lines] Updated payment {payment.id}")
                                
                        except Exception as e:
                            _logger.error(f"[MultiCurrency Payment Lines] Error: {e}")
        
        return payments