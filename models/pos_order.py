# -*- coding: utf-8 -*-
from odoo import models, fields, api
import logging

_logger = logging.getLogger(__name__)


class PosOrder(models.Model):
    _inherit = 'pos.order'

    # In-memory temp storage for multicurrency data between payment and order sync.
    # Note: volatile — lost on worker restart.
    _multicurrency_temp_data = {}

    def _process_payment_lines(self, pos_order, order, pos_session, draft):
        """Override to apply multicurrency data from temp storage"""
        super()._process_payment_lines(pos_order, order, pos_session, draft)

        # Look up temp data by multiple possible keys
        temp_data = None
        search_keys = [
            order.id,
            pos_order.get('uuid') if isinstance(pos_order, dict) else None,
            order.pos_reference,
        ]
        search_keys = [k for k in search_keys if k]

        for key in search_keys:
            if key in self.__class__._multicurrency_temp_data:
                temp_data = self.__class__._multicurrency_temp_data[key]
                break

        if not temp_data:
            return

        payments = order.payment_ids
        for payment_data in temp_data:
            try:
                matching = payments.filtered(
                    lambda p: p.payment_method_id.id == payment_data['payment_method_id']
                )
                if matching:
                    matching[0].write({
                        'payment_currency_id': payment_data['payment_currency_id'],
                        'payment_amount_currency': payment_data['payment_currency_amount'],
                        'payment_exchange_rate': payment_data['payment_exchange_rate'],
                    })
                else:
                    _logger.warning(
                        "MultiCurrency: no matching payment for method %s in order %s",
                        payment_data['payment_method_id'], order.id
                    )
            except Exception as e:
                _logger.error("MultiCurrency: error updating payment in order %s: %s", order.id, e)

        # Clean up temp data
        for key in search_keys:
            self.__class__._multicurrency_temp_data.pop(key, None)

    @api.model
    def store_multicurrency_temp(self, order_uuid, payment_data):
        """Store multicurrency data temporarily keyed by order UUID"""
        if not hasattr(self.__class__, '_multicurrency_temp_data'):
            self.__class__._multicurrency_temp_data = {}

        self.__class__._multicurrency_temp_data.setdefault(order_uuid, []).append(payment_data)
        return True

    @api.model
    def _process_order(self, order, existing_order):
        """Map temp data from UUID to order ID after order creation"""
        pos_order = super()._process_order(order, existing_order)

        if isinstance(order, dict) and 'uuid' in order:
            order_uuid = order['uuid']
            store = self.__class__._multicurrency_temp_data

            if order_uuid in store:
                order_id = pos_order if isinstance(pos_order, int) else pos_order.id
                store[order_id] = store.pop(order_uuid)

        return pos_order
