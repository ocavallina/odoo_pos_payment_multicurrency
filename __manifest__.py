# -*- coding: utf-8 -*-
{
    'name': 'POS Multi-Currency Payments',
    'version': '18.0.1.0.0',
    'category': 'Point of Sale',
    'summary': 'Enable payments in multiple currencies on POS',
    'description': """
        This module extends Odoo POS to support payments in multiple currencies.
    """,
    'depends': ['point_of_sale'],
    'data': [
        'security/ir.model.access.csv',
        'views/pos_config_views.xml',
        'views/pos_payment_method_views.xml',
        'views/pos_payment_multicurrency_report.xml',
    ],
    'assets': {
    'point_of_sale._assets_pos': [
        'pos_payment_multicurrency/static/src/js/multicurrency_visual.js',
        'pos_payment_multicurrency/static/src/js/multicurrency_payment_interface.js',
    ],
},
    'installable': True,
    'auto_install': False,
    'license': 'LGPL-3',
}