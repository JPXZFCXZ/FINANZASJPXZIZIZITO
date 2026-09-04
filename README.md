# Finanzas — control de negocios y ahorro

App web (HTML + CSS + JS puro) para controlar tus negocios: costo/precio de productos,
ventas, ganancia, y un apartado de ahorros aparte. Login por usuario con Supabase, así que
puedes tener varios negocios y tus datos quedan guardados en la nube.

## 1. Crear el proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) → crea una cuenta (gratis) → **New Project**.
2. Ponle un nombre, elige una contraseña de base de datos y espera a que se cree (1-2 min).
3. En el menú lateral, ve a **SQL Editor** → **New query**.
4. Copia y pega **todo** el contenido del archivo `sql/schema.sql` de este proyecto → dale **Run**.
   Esto crea las tablas (`businesses`, `products`, `sales`, `savings`) y las reglas de seguridad
   para que cada usuario solo vea sus propios datos.
5. Ve a **Authentication → Providers** y confirma que **Email** esté habilitado (viene activado por defecto).
   - Si quieres probar rápido sin verificar correo: **Authentication → Settings** → desactiva
     "Confirm email" (solo para desarrollo, no lo dejes así en producción).
6. Ve a **Project Settings → API**. Ahí vas a ver:
   - **Project URL**
   - **anon public key**

## 2. Conectar la app a tu proyecto

Abre `js/config.js` y reemplaza:

```js
const SUPABASE_URL = "PON_AQUI_TU_SUPABASE_URL";
const SUPABASE_ANON_KEY = "PON_AQUI_TU_SUPABASE_ANON_KEY";
```

con los valores que copiaste en el paso anterior.

> La `anon key` es pública y segura de exponer en el frontend — la seguridad real la dan
> las políticas RLS que ya creaste en el paso 4. Nunca subas la `service_role key` a GitHub.

## 3. Probarla localmente

No puedes abrir `index.html` con doble clic (el navegador bloquea algunas cosas por seguridad).
Levanta un servidor simple:

```bash
# Con Python (casi cualquier PC lo tiene)
cd finanzas-app
python3 -m http.server 8000
```

Abre `http://localhost:8000` en tu navegador.

## 4. Subir a GitHub

```bash
cd finanzas-app
git init
git add .
git commit -m "Primera versión: control de negocios y ahorro"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

## 5. (Opcional) Publicarla gratis con GitHub Pages

1. En tu repo de GitHub: **Settings → Pages**.
2. En "Branch", elige `main` y carpeta `/ (root)` → **Save**.
3. En un par de minutos tu app estará en `https://TU_USUARIO.github.io/TU_REPO/`.

## Estructura del proyecto

```
finanzas-app/
├── index.html          # Login + app completa
├── css/style.css        # Estilos y animaciones
├── js/config.js         # Tus llaves de Supabase (NO subir con datos reales a un repo público
│                         #  si algún día usas la service_role key; la anon key sí es segura)
├── js/app.js             # Toda la lógica (auth, negocios, productos, ventas, ahorros)
└── sql/schema.sql        # Tablas y seguridad para pegar en Supabase
```

## Cómo funciona el modelo de datos

- **Ahorros**: son tuyos como usuario, no pertenecen a ningún negocio. Sirven como tu
  colchón personal aparte de cualquier proyecto.
- **Negocios**: cada uno es independiente. Puedes tener "Pastelería", "Reventa de tenis", etc.,
  cada uno con sus propios productos y ventas.
- **Productos**: guardan costo y precio de venta. El margen se calcula solo.
- **Ventas**: al registrar una venta, se guarda una "foto" del costo y precio del producto
  en ese momento — así si luego cambias el precio del producto, tus ventas viejas no cambian
  de valor retroactivamente (es como se hace en sistemas de ventas reales).

## Ideas para seguir creciendo la app

- Gráficas de ganancia por mes (con Chart.js, es ligero y fácil).
- Exportar movimientos a CSV.
- Editar/eliminar productos y ventas (ahora mismo solo se pueden crear).
- Meta de ahorro con barra de progreso.
- Modo oscuro.
