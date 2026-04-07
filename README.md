# POS Multi-Currency Payments

Modulo de Odoo que extiende el Punto de Venta (POS) para aceptar pagos en multiples monedas con conversion automatica de tasas de cambio.

## Compatibilidad

| Branch | Version Odoo | Estado |
|--------|-------------|--------|
| `main` | 19.0 | Activa |
| `18.0` | 18.0 | Mantenimiento |

## Dependencias

- `point_of_sale` (modulo base de Odoo)

## Instalacion

1. Clonar el repositorio en el directorio de addons de Odoo:
   ```bash
   cd /path/to/odoo/addons
   git clone https://github.com/ocavallina/odoo_pos_payment_multicurrency.git pos_payment_multicurrency
   ```

2. Para Odoo 18, cambiar al branch correspondiente:
   ```bash
   git checkout 18.0
   ```

3. Actualizar la lista de aplicaciones en Odoo y buscar "POS Multi-Currency Payments".

4. Instalar el modulo.

## Configuracion

### 1. Activar Multi-Currency en el POS

- Ir a **Punto de Venta > Configuracion > Punto de Venta**
- En la seccion **Multi-Currency Payments**, activar el checkbox
- Seleccionar la **Moneda Base** (por defecto usa la moneda de la compania)

### 2. Configurar Metodos de Pago con Moneda Extranjera

- Ir a **Punto de Venta > Configuracion > Metodos de Pago**
- Editar el metodo de pago deseado (ej: "Efectivo Divisa")
- En la seccion **Multi-Currency**:
  - **Payment Currency**: Seleccionar la moneda extranjera (ej: USD)
  - **Exchange Rate Source**: Elegir entre:
    - **Automatic (Odoo Rates)**: Usa las tasas de cambio configuradas en Odoo
    - **Manual Rate**: Permite ingresar una tasa fija
  - **Manual Exchange Rate**: Solo visible si se elige tasa manual. Formato: `1 moneda extranjera = X moneda base`

### 3. Configurar Tasas de Cambio (si usa Automatic)

- Ir a **Contabilidad > Configuracion > Monedas**
- Asegurarse de que las monedas extranjeras esten activas
- Configurar las tasas de cambio o activar la actualizacion automatica

## Uso en el Punto de Venta

1. Abrir una sesion de POS y agregar productos al carrito
2. Ir a la pantalla de **Pago**
3. Seleccionar un metodo de pago con moneda extranjera (ej: "Efectivo Divisa")
4. Se abrira un **modal de conversion** que muestra:
   - Monto pendiente por pagar en moneda base
   - Equivalente sugerido en moneda extranjera
   - Campo para ingresar el monto recibido en moneda extranjera
   - Conversion en tiempo real al monto base
   - Tasa de cambio utilizada
5. Ingresar el monto recibido y presionar **Confirmar Pago**
6. El sistema registra tanto el monto en moneda base como los datos originales en moneda extranjera

## Reportes

- Acceder via **Punto de Venta > Multi-Currency Payments**
- Muestra todos los pagos realizados en moneda extranjera con:
  - Fecha del pago
  - Sesion POS
  - Metodo de pago
  - Monto en moneda base
  - Moneda extranjera utilizada
  - Monto en moneda extranjera
  - Tasa de cambio aplicada

## Arquitectura Tecnica

### Flujo de datos

```
[Frontend: Modal de pago]
        |
        |-- 1. Captura monto en moneda extranjera
        |-- 2. Calcula conversion a moneda base
        |-- 3. Crea linea de pago con monto base
        |-- 4. Envia datos multicurrency al backend (HTTP POST)
        v
[Backend: Almacenamiento temporal]
        |
        |-- Dict en memoria indexado por UUID de orden
        v
[Backend: Procesamiento de orden]
        |
        |-- _process_order() mapea UUID -> order ID
        |-- _process_payment_lines() escribe campos multicurrency en pos.payment
        v
[Base de datos: pos.payment]
        |
        |-- payment_currency_id (moneda extranjera)
        |-- payment_amount_currency (monto original)
        |-- payment_exchange_rate (tasa usada)
```

### Modelos extendidos

| Modelo | Campos agregados | Proposito |
|--------|-----------------|-----------|
| `pos.config` | `multi_currency_payments`, `base_currency_id` | Habilitar y configurar moneda base |
| `pos.payment.method` | `payment_currency_id`, `exchange_rate_source`, `manual_exchange_rate`, `current_exchange_rate` | Moneda y tasa por metodo de pago |
| `pos.payment` | `payment_currency_id`, `payment_amount_currency`, `payment_exchange_rate` | Datos originales de la transaccion |

### Endpoints HTTP

| Ruta | Descripcion |
|------|-------------|
| `/pos/get_multicurrency_methods` | Obtiene metadata de monedas para metodos de pago |
| `/pos/save_multicurrency_payment_temp` | Almacena datos multicurrency antes de sincronizar orden |
| `/pos/refresh_exchange_rates` | Refresca tasas de cambio en vivo |
| `/pos/save_multicurrency_payment` | Escritura directa a pos.payment (alternativa post-orden) |

## Notas Importantes

- **Almacenamiento temporal volatil**: Los datos multicurrency se mantienen en memoria entre el momento del pago y la sincronizacion de la orden. Si el servidor de Odoo se reinicia en ese intervalo, los datos de moneda extranjera se pierden (el pago base se registra normalmente).
- **Convencion de tasa**: `1 moneda extranjera = X moneda base`. Ejemplo: si 1 USD = 474.53 VES, la tasa es 474.53.
- **Campos Many2one en POS**: En Odoo 19, los campos Many2one no se resuelven automaticamente en el frontend POS via `_load_pos_data_fields`. Por eso se usa un endpoint HTTP para cargar la metadata de monedas.
- **Totales de orden en Odoo 19**: Los getters `totalDue`, `remainingDue` y `amountPaid` viven en el prototipo `PosOrderAccounting` y requieren acceso via la cadena de prototipos.

## Licencia

LGPL-3
