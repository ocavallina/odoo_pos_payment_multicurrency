# -*- coding: utf-8 -*-
from odoo import models, fields, api
import logging

_logger = logging.getLogger(__name__)

class PosOrder(models.Model):
    _inherit = 'pos.order'

    @api.model
    def _process_payment_lines(self, pos_order, order, pos_session, draft):
        """Override to handle multicurrency payment data"""
        payments = super()._process_payment_lines(pos_order, order, pos_session, draft)
        
        # Process multicurrency data from frontend
        payment_data_list = order.get('statement_ids', [])
        
        for payment_data in payment_data_list:
            if len(payment_data) >= 3 and isinstance(payment_data[2], dict):
                frontend_data = payment_data[2]
                
                # Check if this is a multicurrency payment
                if frontend_data.get('is_multicurrency'):
                    try:
                        # Find corresponding payment record
                        payment = None
                        for p in payments:
                            if p.payment_method_id.id == frontend_data.get('payment_method_id'):
                                payment = p
                                break
                        
                        if payment:
                            # Update with multicurrency data
                            payment.write({
                                'payment_currency_id': frontend_data.get('payment_currency_id'),
                                'payment_amount_currency': frontend_data.get('payment_currency_amount'),
                                'payment_exchange_rate': frontend_data.get('payment_exchange_rate'),
                            })
                            
                            _logger.info(f"Multicurrency data saved for payment {payment.id}: "
                                       f"{frontend_data.get('payment_currency_amount')} "
                                       f"at rate {frontend_data.get('payment_exchange_rate')}")
                        
                    except Exception as e:
                        _logger.error(f"Error saving multicurrency data: {e}")
        
        return payments