# -*- coding: utf-8 -*-
{
    'name': 'POS Multi-Currency Payments',
    'version': '18.0.1.0.0',
    'category': 'Point of Sale',
    'summary': 'Enable payments in multiple currencies on POS',
    'description': """
        This module extends Odoo POS to support payments in multiple currencies.
        Features:
        - Enable multi-currency payments per POS configuration
        - Set specific currency per payment method
        - Real-time currency conversion using Odoo exchange rates
        - Automatic exchange rate handling
    """,
    'depends': ['point_of_sale'],
    'data': [
        'views/pos_config_views.xml',
        'views/pos_payment_method_views.xml',
    ],
    'assets': {
        'point_of_sale._assets_pos': [
            'pos_payment_multicurrency/static/src/js/payment_line.js',
            'pos_payment_multicurrency/static/src/js/payment_screen.js',
        ],
    },
    'installable': True,
    'auto_install': False,
    'license': 'LGPL-3',
}
