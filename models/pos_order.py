# -*- coding: utf-8 -*-
from odoo import models, fields, api
import logging

_logger = logging.getLogger(__name__)

class PosOrder(models.Model):
    _inherit = 'pos.order'

    # Variable temporal para almacenar datos multicurrency
    _multicurrency_temp_data = {}

    def _process_payment_lines(self, pos_order, order, pos_session, draft):
        """Override para procesar datos multicurrency usando almacén temporal"""
        
        _logger.info(f"[MultiCurrency] _process_payment_lines called for order {order.id}")
        
        # PASO 1: Llamar al método padre para crear los payments básicos
        super()._process_payment_lines(pos_order, order, pos_session, draft)
        
        # PASO 2: Buscar datos multicurrency usando múltiples claves
        temp_data = None
        search_keys = [
            order.id,  # Order ID
            pos_order.get('uuid') if isinstance(pos_order, dict) else None,  # UUID de la orden
            order.pos_reference,  # Referencia POS
        ]
        
        # Filtrar keys válidas
        search_keys = [key for key in search_keys if key]
        
        _logger.info(f"[MultiCurrency] Searching for temp data with keys: {search_keys}")
        
        for key in search_keys:
            if key in self.__class__._multicurrency_temp_data:
                temp_data = self.__class__._multicurrency_temp_data[key]
                _logger.info(f"[MultiCurrency] Found temporary data for key {key}: {temp_data}")
                break
        
        if temp_data:
            payments = order.payment_ids
            _logger.info(f"[MultiCurrency] Processing {len(temp_data)} multicurrency entries for {len(payments)} payments")
            
            for payment_data in temp_data:
                try:
                    # Buscar payment por método de pago
                    matching_payment = payments.filtered(
                        lambda p: p.payment_method_id.id == payment_data['payment_method_id']
                    )
                    
                    if matching_payment:
                        payment = matching_payment[0]  # Tomar el primero
                        payment.write({
                            'payment_currency_id': payment_data['payment_currency_id'],
                            'payment_amount_currency': payment_data['payment_currency_amount'],
                            'payment_exchange_rate': payment_data['payment_exchange_rate'],
                        })
                        _logger.info(f"[MultiCurrency] ✅ Updated payment {payment.id} with multicurrency data")
                    else:
                        _logger.warning(f"[MultiCurrency] ❌ No matching payment found for method {payment_data['payment_method_id']}")
                        
                except Exception as e:
                    _logger.error(f"[MultiCurrency] Error updating payment: {e}")
            
            # Limpiar datos temporales de todas las claves usadas
            for key in search_keys:
                if key in self.__class__._multicurrency_temp_data:
                    del self.__class__._multicurrency_temp_data[key]
        else:
            _logger.info(f"[MultiCurrency] No temporary multicurrency data found")
        
        _logger.info(f"[MultiCurrency] Processing complete for order {order.id}")

    @api.model
    def store_multicurrency_temp(self, order_uuid, payment_data):
        """Almacenar datos multicurrency temporalmente usando UUID de orden"""
        if not hasattr(self.__class__, '_multicurrency_temp_data'):
            self.__class__._multicurrency_temp_data = {}
            
        if order_uuid not in self.__class__._multicurrency_temp_data:
            self.__class__._multicurrency_temp_data[order_uuid] = []
            
        self.__class__._multicurrency_temp_data[order_uuid].append(payment_data)
        _logger.info(f"[MultiCurrency] Stored temp data for order {order_uuid}: {payment_data}")
        
        return True

    @api.model
    def _process_order(self, order, existing_order):
        """Hook para mapear UUID a order ID"""
        _logger.info("[MultiCurrency] Processing complete order")
        
        # Procesar orden normalmente
        pos_order = super()._process_order(order, existing_order)
        
        # Mapear datos temporales de UUID a order ID
        if isinstance(order, dict) and 'uuid' in order:
            order_uuid = order['uuid']
            
            if (hasattr(self.__class__, '_multicurrency_temp_data') and 
                order_uuid in self.__class__._multicurrency_temp_data):
                
                # Mover datos de UUID a order ID
                temp_data = self.__class__._multicurrency_temp_data[order_uuid]
                order_id = pos_order if isinstance(pos_order, int) else pos_order.id
                self.__class__._multicurrency_temp_data[order_id] = temp_data
                
                # Limpiar UUID
                del self.__class__._multicurrency_temp_data[order_uuid]
                
                _logger.info(f"[MultiCurrency] Mapped temp data from UUID {order_uuid} to order ID {order_id}")
        
        return pos_order