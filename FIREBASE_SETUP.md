# Configuración de Firebase

La aplicación usa Firebase Authentication (correo y contraseña), Realtime Database y Cloud Storage. La configuración del SDK del navegador está en `js/10-firebase-bootstrap.js`; la API key de Firebase identifica el proyecto y no sustituye reglas de seguridad.

## 1. Habilitar autenticación

En Firebase Console, abre **Authentication → Sign-in method** y habilita **Correo electrónico/contraseña**. No se ofrece registro público. Para la configuración inicial, crea la primera cuenta administradora en Authentication y registra su perfil activo en Realtime Database; después, usa **Administración** dentro del panel para crear cuentas docentes y administrativas.

## 2. Centros, perfiles y reglas de la base de datos

Los datos académicos viven en `/centers/{centerId}/appData`. Cada cuenta docente tiene exactamente un `centerId`; sus lecturas y escrituras quedan limitadas a ese centro. Los administradores son globales y pueden administrar centros y operar el centro seleccionado. Las cuentas existentes sin centro no pueden abrir el panel hasta que administración les asigne uno.

Los responsables académicos del cuaderno se guardan en `cuadernoConfig` dentro de los datos del centro; las reglas permiten actualizarlos a cuentas activas de ese centro. Las preferencias de exportación del navegador se guardan por cuenta y centro. Al primer acceso después de esta actualización, la preferencia antigua del navegador se copia una sola vez al primer perfil que la use.

Publica el contenido actualizado de `database.rules.json` en **Realtime Database → Rules antes de actualizar/recargar el panel**. Las reglas deniegan acceso por defecto, exigen un perfil activo y aplican el aislamiento por centro.

Al iniciar por primera vez un administrador antiguo sin `centerId`, el panel crea `/centers/ct-ariel-darce/metadata`, copia el `/appData` antiguo a `/centers/ct-ariel-darce/appData`, verifica la copia y asigna el administrador a ese centro. La ruta antigua `/appData` se conserva como respaldo y queda accesible solo para administradores. No la borres hasta validar la migración.

Para el alta manual de la primera cuenta administradora, copia su UID y crea en **Realtime Database → Data** el registro `/users/{UID}`:

```json
{
  "active": true,
  "displayName": "Nombre del docente",
  "email": "docente@inatec.edu.ni",
  "role": "docente",
  "centerId": "ct-ariel-darce"
}
```

Para la primera cuenta administrativa, usa `"role": "admin"`; el primer acceso también asigna automáticamente el centro histórico de Ariel Darce si no tiene `centerId`. No se habilita registro público. Después, el administrador global puede crear centros, crear cuentas, asignar un único centro y configurar el área docente.

La información institucional editable por la persona se guarda por separado en `/staffProfiles/{uid}`: nombres, apellidos, teléfono institucional, código de empleado, cargo, área (`general`, `ingles`, `tic` u `otra`) y especialidad/módulos. La cuenta puede editar esos campos en **Mi perfil**; correo, rol y centro no se editan desde ahí. Los administradores pueden corregir los datos institucionales de otras cuentas. La especialidad de Inglés etiqueta el perfil en el panel compartido; el modelo de grupos y evaluaciones existente se conserva.

## 3. Preparar `appData`

La importación desde **Cargar DB.json** guarda la base en el centro operativo del administrador, bajo `/centers/{centerId}/appData`; grupos y equipos no se mezclan con los de otros centros. La copia de seguridad de `/appData` anterior a esta separación no se elimina automáticamente.

En la primera carga, la aplicación migra los registros al formato actual, que codifica y restaura automáticamente nombres de columnas o evaluaciones que contengan caracteres no admitidos como claves de Realtime Database (por ejemplo, puntos en títulos de cuestionarios). No reemplaces manualmente esa codificación.

Una base vacía no se rellena automáticamente con datos de muestra. El administrador puede cargar una copia JSON válida mediante **Cargar DB.json** en la barra superior. Se aceptan exportaciones con `grupos` y `equipos` como arreglos o mapas, así como un respaldo que los contenga bajo `appData`. En Administración, selecciona el centro operativo antes de importar, descargar o editar datos.

## 4. Publicar las reglas de Storage

En **Storage → Rules**, publica `storage.rules`. Los archivos nuevos se guardan en `team-attachments/` y el contenido binario no se coloca en Realtime Database. Para descargar, la aplicación solicita una URL de Firebase Storage con la sesión activa y recupera el archivo mediante `fetch`; el bucket necesita CORS para el dominio del dashboard.

Para subir y descargar archivos desde el navegador, configura CORS en el bucket. Sustituye el nombre por el bucket exacto que muestra Firebase Console si es distinto y añade el origen HTTPS real en `firebase-storage-cors.json` (incluye el origen local exacto, puerto incluido, si haces pruebas locales):

```powershell
gcloud storage buckets update gs://ina-tions.firebasestorage.app --cors-file=firebase-storage-cors.json
```

Añade a la lista `origin` el dominio HTTPS donde publiques la aplicación. No publiques el dashboard mediante `file://`; Authentication, CORS y los dominios autorizados requieren un origen web. En Firebase Console, registra los dominios de Hosting en **Authentication → Settings → Authorized domains**.

## 5. Publicar

Sirve la carpeta con un servidor web HTTPS. Los archivos `database.rules.json` y `storage.rules` deben publicarse en Firebase Console o desplegarse con Firebase CLI. La aplicación no contiene credenciales administrativas ni puede publicar reglas desde el navegador.

Los perfiles docentes pueden editar registros de grupos y equipos; solo los administradores pueden reemplazar la base completa y administrar perfiles. La sección **Administración** aparece solo para cuentas con rol `admin`; permite crear cuentas, enviar el enlace para establecer contraseña, cambiar roles, activar/desactivar perfiles y reenviar correos de recuperación. Al crear un usuario, la aplicación usa una sesión secundaria de Firebase Authentication para no cerrar la sesión del administrador. Las reglas de Realtime Database deben incluir el permiso de lectura de `/users` reservado al administrador para mostrar la lista. Publica `database.rules.json` actualizado antes de usar esta sección.

Desactivar un perfil bloquea las lecturas y escrituras de esa cuenta en Realtime Database mediante las reglas. La aplicación impide desactivar al administrador conectado o retirar el rol del último administrador activo.

Las reglas de Storage restringen lectura y borrado a la cuenta cuyo UID figura en la ruta del archivo (`team-attachments/{uid}/...`). Las subidas validan que el UID de la ruta y el metadato `uploadedBy` coincidan con la sesión. La aplicación también oculta y bloquea las acciones para otros usuarios. Para activar esta restricción, publica `storage.rules`; los archivos antiguos bajo `team-attachments/` quedan accesibles únicamente para su propietario.

Storage Rules no puede consultar los perfiles de Realtime Database: la restricción todavía no valida el centro ni el campo `active`. Desactivar una cuenta no revoca por sí solo un token de Authentication; para revocarlo, deshabilita también la cuenta en Firebase Authentication. Los adjuntos antiguos que solo existían como `dataUrl` no tienen uploader verificable; su migración automática se realiza con la sesión del administrador que migra, que pasa a ser su propietario en Storage.

No se puede eliminar un equipo mientras conserve archivos almacenados que pertenezcan a otras cuentas; sus propietarios deben retirarlos primero. Así se conserva la referencia y no se dejan objetos huérfanos en Storage.

Los registros de grupos y equipos mantienen `updatedAt` y `updatedBy` al modificarse, para facilitar la atribución y el diagnóstico de cambios. Esto es metadato del último cambio, no un historial inmutable ni un sistema de auditoría; para trazabilidad completa se requiere un backend con retención y acceso administrativo.

## Despliegue de reglas con Firebase CLI (opcional)

Desde esta carpeta, después de instalar Firebase CLI e iniciar sesión:

```powershell
firebase deploy --only database,storage
```

El archivo `.firebaserc` apunta al proyecto `ina-tions`. Comprueba que el proyecto seleccionado y las reglas mostradas en Firebase Console sean los esperados antes de desplegar.

## Pruebas locales

Con Node.js 18 o posterior, ejecuta las pruebas de persistencia sin conectarte a Firebase:

```powershell
node --test .\tests\*.test.cjs
```

Las reglas de Storage deben probarse también en Firebase Console o con Firebase Emulator antes de publicarlas; las pruebas Node locales no simulan la autorización del servicio.
