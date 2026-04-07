/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { useState } from "@odoo/owl";

patch(PaymentScreen.prototype, {

    setup() {
        super.setup();
        // Map: paymentMethodId -> { currency_id, currency_name, currency_symbol }
        this.currencyMap = new Map();
        this.multicurrencyState = useState({
            showCurrencyInput: false,
            selectedMethod: null,
            currencyAmount: 0,
            convertedAmount: 0,
            exchangeRate: 1,
            currencySymbol: '',
            currencyName: '',
        });
        this._loadCurrencyMap();
    },

    async _loadCurrencyMap() {
        try {
            const response = await fetch('/pos/get_multicurrency_methods', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'call',
                    params: { config_id: this.pos.config.id },
                    id: Date.now(),
                }),
            });

            const data = await response.json();
            if (data.result?.success) {
                const methods = data.result.methods;
                for (const [methodId, currencyInfo] of Object.entries(methods)) {
                    this.currencyMap.set(parseInt(methodId), currencyInfo);
                }
                console.log(`[MultiCurrency] Loaded currency map: ${this.currencyMap.size} methods configured`);
            }
        } catch (error) {
            console.error('[MultiCurrency] Error loading currency map:', error);
        }
    },

    addNewPaymentLine(paymentMethod) {
        const currencyInfo = this.currencyMap.get(paymentMethod.id);
        if (currencyInfo) {
            const rate = paymentMethod.current_exchange_rate || 1;
            this._showCurrencyInputModal(paymentMethod, currencyInfo, rate);
            return;
        }
        return super.addNewPaymentLine(paymentMethod);
    },

    _showCurrencyInputModal(paymentMethod, currencyInfo, rate) {
        const baseCurrency = this.pos.config.currency_id || { name: 'Base', symbol: '$' };

        this.multicurrencyState.showCurrencyInput = true;
        this.multicurrencyState.selectedMethod = paymentMethod;
        this.multicurrencyState.exchangeRate = rate;
        this.multicurrencyState.currencySymbol = currencyInfo.currency_symbol;
        this.multicurrencyState.currencyName = currencyInfo.currency_name;
        this.multicurrencyState.currencyId = currencyInfo.currency_id;
        this.multicurrencyState.currencyAmount = 0;
        this.multicurrencyState.convertedAmount = 0;

        let pendingAmount = 0;
        try {
            // Odoo 19: get current order - try multiple APIs
            const order = this.currentOrder
                || this.pos.selectedOrder
                || (typeof this.pos.get_order === 'function' ? this.pos.get_order() : null);
            if (order) {
                // Odoo 19: totalDue/remainingDue/amountPaid live on PosOrderAccounting prototype
                // Walk the prototype chain to find and call the getters
                const _getFromProtoChain = (obj, prop) => {
                    let p = Object.getPrototypeOf(obj);
                    while (p && p !== Object.prototype) {
                        const desc = Object.getOwnPropertyDescriptor(p, prop);
                        if (desc && desc.get) return desc.get.call(obj);
                        if (desc && typeof desc.value === 'function') return desc.value.call(obj);
                        p = Object.getPrototypeOf(p);
                    }
                    return undefined;
                };

                const remaining = _getFromProtoChain(order, 'remainingDue');
                const totalDue = _getFromProtoChain(order, 'totalDue');
                const paid = _getFromProtoChain(order, 'amountPaid');

                if (remaining !== undefined && remaining !== 0) {
                    pendingAmount = remaining;
                } else if (totalDue !== undefined) {
                    pendingAmount = totalDue - (paid || 0);
                }

            }
        } catch (e) {
            console.warn('[MultiCurrency] Error getting order totals:', e);
        }

        const suggestedForeignAmount = (pendingAmount / rate).toFixed(2);

        const formatBase = (amount) => {
            const sym = baseCurrency.symbol || '$';
            return `${sym}${amount.toFixed(2)}`;
        };

        const cSym = currencyInfo.currency_symbol;
        const cName = currencyInfo.currency_name;

        // Build modal
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position:fixed; top:0; left:0; width:100vw; height:100vh;
            background:rgba(0,0,0,0.7); z-index:999999;
            display:flex; align-items:center; justify-content:center;
        `;

        const card = document.createElement('div');
        card.style.cssText = `
            background:#fff; border-radius:15px; padding:30px;
            min-width:400px; max-width:500px;
            box-shadow:0 10px 30px rgba(0,0,0,0.5); text-align:center;
        `;

        card.innerHTML = `
            <div style="margin-bottom:20px;">
                <h3 style="color:#2c3e50; margin-bottom:10px;">Pago en ${cName}</h3>
                <div style="color:#7f8c8d; font-size:14px;">Método: ${paymentMethod.name}</div>
            </div>

            <div style="margin-bottom:20px; padding:15px; background:#f8f9fa; border-radius:8px;">
                <div style="font-size:14px; color:#6c757d; margin-bottom:5px;">Pendiente por pagar:</div>
                <div style="font-size:18px; font-weight:bold; color:#2c3e50;">
                    ${formatBase(pendingAmount)}
                </div>
                <div style="font-size:12px; color:#6c757d; margin-top:5px;">
                    ≈ ${cSym}${suggestedForeignAmount} ${cName}
                </div>
            </div>

            <div style="margin-bottom:20px;">
                <label style="display:block; font-weight:bold; margin-bottom:10px; color:#2c3e50;">
                    Monto recibido en ${cName}:
                </label>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:20px; font-weight:bold; color:#2c3e50;">${cSym}</span>
                    <input
                        type="number"
                        id="mc-currency-input"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        value="${suggestedForeignAmount}"
                        style="
                            flex:1; padding:12px; font-size:18px;
                            border:2px solid #3498db; border-radius:8px;
                            text-align:right; font-weight:bold;
                        "
                    />
                </div>
            </div>

            <div style="margin-bottom:20px; padding:15px; background:#e8f5e8; border-radius:8px; border-left:4px solid #28a745;">
                <div style="color:#155724; font-size:14px; margin-bottom:5px;">Equivalente en ${baseCurrency.name}:</div>
                <div id="mc-converted-display" style="font-size:24px; font-weight:bold; color:#28a745;">
                    ${formatBase(parseFloat(suggestedForeignAmount) * rate)}
                </div>
                <div style="color:#6c757d; font-size:12px; margin-top:5px;">
                    Tasa: 1 ${cName} = ${rate.toFixed(4)} ${baseCurrency.name}
                </div>
            </div>

            <div style="display:flex; gap:10px;">
                <button id="mc-btn-cancel" style="
                    flex:1; padding:12px; background:#6c757d; color:#fff;
                    border:none; border-radius:8px; font-size:16px;
                    font-weight:bold; cursor:pointer;
                ">Cancelar</button>
                <button id="mc-btn-confirm" style="
                    flex:1; padding:12px; background:#28a745; color:#fff;
                    border:none; border-radius:8px; font-size:16px;
                    font-weight:bold; cursor:pointer;
                ">Confirmar Pago</button>
            </div>
        `;

        overlay.appendChild(card);
        document.body.appendChild(overlay);

        // Wire events
        const input = overlay.querySelector('#mc-currency-input');
        const convertedEl = overlay.querySelector('#mc-converted-display');

        input.addEventListener('input', (e) => {
            const amt = parseFloat(e.target.value) || 0;
            const converted = amt * rate;
            convertedEl.textContent = formatBase(converted);
            this.multicurrencyState.currencyAmount = amt;
            this.multicurrencyState.convertedAmount = converted;
        });

        overlay.querySelector('#mc-btn-cancel').addEventListener('click', () => {
            overlay.remove();
            this.multicurrencyState.showCurrencyInput = false;
        });

        overlay.querySelector('#mc-btn-confirm').addEventListener('click', () => {
            overlay.remove();
            this._confirmCurrencyPayment();
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
                this.multicurrencyState.showCurrencyInput = false;
            }
        });

        // Trigger initial calculation and focus
        input.dispatchEvent(new Event('input'));
        setTimeout(() => { input.focus(); input.select(); }, 100);
    },

    async _confirmCurrencyPayment() {
        const method = this.multicurrencyState.selectedMethod;
        const currencyAmount = this.multicurrencyState.currencyAmount;
        const convertedAmount = this.multicurrencyState.convertedAmount;
        const rate = this.multicurrencyState.exchangeRate;
        const currencyId = this.multicurrencyState.currencyId;

        if (!currencyAmount || currencyAmount <= 0) {
            this._showNotification('Por favor ingrese un monto válido', 'error');
            return;
        }

        try {
            const paymentCreated = await super.addNewPaymentLine(method);

            if (!paymentCreated) {
                this._showNotification('Error al crear línea de pago', 'error');
                return;
            }

            const order = this.currentOrder
                || this.pos.selectedOrder
                || (typeof this.pos.get_order === 'function' ? this.pos.get_order() : null);
            const paymentLine = this._findLastPaymentLine(order, method);

            if (!paymentLine) {
                this._showNotification('No se encontró la línea de pago creada', 'error');
                return;
            }

            // Set converted base amount
            if (typeof paymentLine.set_amount === 'function') {
                paymentLine.set_amount(convertedAmount);
            } else {
                paymentLine.amount = convertedAmount;
            }

            // Patch export_as_JSON to include multicurrency data on sync
            const originalExport = paymentLine.export_as_JSON;
            paymentLine.export_as_JSON = function () {
                const json = originalExport ? originalExport.call(this) : {};
                json.is_multicurrency = true;
                json.payment_currency_id = currencyId;
                json.payment_currency_amount = currencyAmount;
                json.payment_exchange_rate = rate;
                return json;
            };

            // Send multicurrency data to backend temp storage
            await this._sendMulticurrencyTemp(order, method, currencyId, currencyAmount, rate, convertedAmount);

            this.render();

            const cSym = this.multicurrencyState.currencySymbol;
            const cName = this.multicurrencyState.currencyName;
            this._showNotification(
                `${cSym}${currencyAmount.toFixed(2)} ${cName} registrado`,
                'success'
            );

        } catch (error) {
            console.error('[MultiCurrency] Error confirming payment:', error);
            this._showNotification('Error al procesar el pago: ' + error.message, 'error');
        }

        this.multicurrencyState.showCurrencyInput = false;
    },

    _findLastPaymentLine(order, method) {
        let paymentLines = order.payment_ids || order.paymentlines;
        if (!paymentLines && typeof order.get_paymentlines === 'function') {
            try { paymentLines = order.get_paymentlines(); } catch {}
        }
        if (!paymentLines) return null;

        const iterate = (collection) => {
            if (Array.isArray(collection)) return collection;
            if (collection.models) return collection.models;
            if (typeof collection.forEach === 'function') {
                const arr = [];
                collection.forEach(p => arr.push(p));
                return arr;
            }
            return [];
        };

        const arr = iterate(paymentLines);
        for (let i = arr.length - 1; i >= 0; i--) {
            if (arr[i].payment_method_id?.id === method.id) {
                return arr[i];
            }
        }
        return null;
    },

    async _sendMulticurrencyTemp(order, method, currencyId, currencyAmount, rate, convertedAmount) {
        const orderUuid = order?.uuid || order?.uid || `temp_${Date.now()}`;

        try {
            const response = await fetch('/pos/save_multicurrency_payment_temp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'call',
                    params: {
                        order_uuid: orderUuid,
                        payment_method_id: method.id,
                        payment_currency_id: currencyId,
                        payment_currency_amount: currencyAmount,
                        payment_exchange_rate: rate,
                        base_amount: convertedAmount,
                    },
                    id: Date.now(),
                }),
            });

            const data = await response.json();
            if (!data.result?.success) {
                console.warn('[MultiCurrency] Temp storage failed:', data.result?.error);
            }
        } catch (error) {
            console.warn('[MultiCurrency] Error sending temp data:', error);
        }
    },

    _showNotification(message, type) {
        const colors = {
            success: 'linear-gradient(45deg, #28a745, #20c997)',
            error: '#dc3545',
        };
        const el = document.createElement('div');
        el.style.cssText = `
            position:fixed; top:20px; right:20px; z-index:999998;
            background:${colors[type] || colors.success};
            color:#fff; padding:15px 20px; border-radius:10px;
            font-size:16px; font-weight:bold;
            box-shadow:0 4px 12px rgba(0,0,0,0.3);
            max-width:350px;
        `;
        el.textContent = message;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 4000);
    },
});
