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
        - Automatic and manual exchange rate handling
        - Proper validation and error handling
    """,
    'depends': ['point_of_sale'],
    'data': [
        'security/ir.model.access.csv',
        'views/pos_config_views.xml',
        'views/pos_payment_method_views.xml',
    ],
    'assets': {
        # Assets deshabilitados - archivo faltante
    },
    'installable': True,
    'auto_install': False,
    'license': 'LGPL-3',
    'author': 'Your Company',
    'website': 'https://www.yourcompany.com',
}