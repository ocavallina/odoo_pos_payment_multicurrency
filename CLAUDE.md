# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Odoo 18 POS module (`pos_payment_multicurrency`) that enables payments in multiple currencies at the Point of Sale. Depends solely on `point_of_sale`.

## Development Commands

```bash
# Restart Odoo with module update
sudo systemctl restart odoo  # or your service name
# Update module via CLI
odoo -u pos_payment_multicurrency -d <database_name> --stop-after-init

# Check Odoo logs for [MultiCurrency] tagged messages
sudo journalctl -u odoo -f | grep MultiCurrency
```

There are no unit tests in this module currently.

## Architecture

### Data Flow for Multi-Currency Payments

The module uses a **temporal storage pattern** to pass multicurrency data from frontend to backend, because POS payment lines are created by the core `_process_payment_lines` method which doesn't support custom fields natively:

1. **Frontend** (`multicurrency_payment_interface.js`): When user pays with a foreign currency method, a modal captures the amount in foreign currency. After creating the standard payment line via `super.addNewPaymentLine()`, it sends multicurrency metadata to the backend via HTTP POST to `/pos/save_multicurrency_payment_temp`.

2. **Temporal storage** (`pos_order.py`): `PosOrder._multicurrency_temp_data` is a class-level dict that stores multicurrency data keyed by order UUID. The `_process_order` override maps UUID keys to order IDs after the order is created.

3. **Payment processing** (`pos_order.py`): `_process_payment_lines` override calls `super()` first, then looks up temp data by order ID/UUID/pos_reference and writes `payment_currency_id`, `payment_amount_currency`, and `payment_exchange_rate` to the matching `pos.payment` records.

### Frontend (JS) — Two patches on PaymentScreen

- `multicurrency_visual.js`: Loads on PaymentScreen setup. Fetches currency config from `/pos/get_multicurrency_methods` HTTP endpoint and patches the in-memory `pos.payment.method` records with currency data (bypasses POS standard data loading).
- `multicurrency_payment_interface.js`: Intercepts `addNewPaymentLine()`. If the method has `payment_currency_id`, shows a currency input modal instead of the default flow. On confirm, creates the payment line with the converted base amount and sends temp data to backend.

### Backend Models

- **`pos.config`**: Adds `multi_currency_payments` boolean toggle and `base_currency_id`. Validates configuration on write.
- **`pos.payment.method`**: Adds `payment_currency_id`, `exchange_rate_source` (auto/manual), `manual_exchange_rate`. Method `get_exchange_rate()` uses Odoo's native `_get_conversion_rate` for auto rates. Extends `_load_pos_data_fields` to send currency fields to frontend.
- **`pos.payment`**: Adds `payment_currency_id`, `payment_amount_currency`, `payment_exchange_rate` to store the original foreign currency transaction details.

### HTTP Controllers (`controllers/main.py`)

All routes are `type='json'`, `auth='user'`:
- `/pos/get_multicurrency_methods` — Returns currency config for all payment methods of a POS config (used by visual.js on load)
- `/pos/save_multicurrency_payment_temp` — Stores multicurrency data in temp dict before order sync
- `/pos/refresh_exchange_rates` — Returns fresh rates for configured methods
- `/pos/get_payment_methods_with_currency` — Simplified method list with currency info
- `/pos/save_multicurrency_payment` — Direct write to `pos.payment` (post-order alternative)

## Key Design Decisions

- **HTTP bypass approach**: The module fetches currency data via direct HTTP calls instead of relying on POS `_load_pos_data_fields` because the standard POS data loading was unreliable for custom fields. This is intentional.
- **Class-level `_multicurrency_temp_data` dict**: Used as in-memory bridge between the HTTP temp-save call and the order processing. This means data does not survive Odoo worker restarts between payment and order finalization.
- **Exchange rate convention**: `1 payment currency = X base currency` (e.g., 1 USD = 20.5 MXN).
- **UI language**: User-facing strings in the JS modals are in Spanish.
