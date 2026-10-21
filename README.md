# Shark Tank Aula v7 — recuperación de ofertas

Versión de aula con registro individual de participantes y panel docente de evaluación.

## Novedades
- Reconexión automática de Socket.IO con recuperación de la identidad del participante mediante un identificador estable por pestaña.
- Mensajes de actividad periódicos para mantener viva la conexión durante presentaciones largas, incluso cuando no se realizan acciones.
- Las ofertas, retiros y aceptaciones se vinculan al identificador estable del participante y no al identificador temporal de la conexión. Si una sesión de inversionista llega al servidor sin estar validada o sin equipo asociado, ahora se informa del problema en lugar de descartar la oferta en silencio; el equipo se reconstruye desde el participante cuando es posible.
- Registro individual de hasta 6 inversionistas y 6 emprendedores.
- Identificación persistente durante la ronda mediante el socket de cada participante.
- El primer emprendedor configura la empresa; los siguientes se incorporan al mismo equipo.
- Panel del profesor con listado de participantes, roles, capital y estilo del inversionista.
- Rúbrica grupal de 100 puntos para inversionistas y emprendedores.
- Rúbrica individual de 100 puntos para cada participante.
- Selección por descriptor: Excelente (100 %), Adecuado (75 %) e Insuficiente (50 %).
- Cálculo automático del puntaje y guardado de la evaluación en la ronda.
- Se conserva la dinámica de ofertas, negociación, temporizador, salas y veredicto.

## Conexiones largas y recuperación de sesión
La página intenta reconectar automáticamente si se interrumpe la red y vuelve a registrar al participante usando la sesión de esa pestaña. Envía además un mensaje de actividad cada 25 segundos. Esto reduce el riesgo de que un servicio de alojamiento suspenda una conexión inactiva y evita que el cambio de `socket.id` invalide las acciones de un inversionista o emprendedor.

La reconexión no puede evitar todos los fallos externos (por ejemplo, perder Internet, cerrar la pestaña o reiniciar el servidor), pero al volver la conexión la aplicación intenta recuperar la identidad y el estado de la ronda. En Render, la persistencia del estado debe configurarse con Supabase para proteger los datos ante reinicios.

## Recuperación robusta de ofertas (v7)
- La acción de ofertar ahora incluye un identificador único de petición y una confirmación explícita del servidor.
- Si el socket perdió su asociación temporal, el servidor intenta recuperar al inversionista a partir de su `sessionId` estable ya registrado.
- Los reintentos de una misma petición son idempotentes: no crean dos ofertas si el servidor ya había registrado la primera y solo se perdió la confirmación.
- Si no se recibe respuesta, la interfaz muestra un mensaje y conserva la selección de billetes; no reinicia la ronda ni obliga a volver a entrar manualmente.
- Se añadieron registros de conexión, desconexión, recuperación de sesión y aceptación/rechazo de ofertas en los Logs de Render.

## Ejecución

```bash
npm install
npm start
```

La aplicación ahora tiene persistencia de estado.

### Persistencia permanente con Supabase (recomendado para Render)

1. Ejecuta `supabase-schema.sql` en el SQL Editor de tu proyecto Supabase.
2. En Render configura estas variables de entorno:
   - `SUPABASE_URL` = URL de tu proyecto Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY` = service role key de Supabase (solo en el servidor; nunca en el navegador).
   - `SHARK_STATE_ID` = opcional; por defecto `shark-tank-aula-main`.
3. Reinicia el servicio.

Las evaluaciones grupales e individuales, participantes, empresa, ofertas y registro quedan guardados en `public.app_state` y se recuperan automáticamente después de reiniciar el servidor.

### Desarrollo local

Si no se configuran las variables de Supabase, la aplicación guarda automáticamente el estado en `data/state.json`. Esto permite probar la persistencia localmente. En Render se recomienda usar Supabase, porque el sistema de archivos local del servicio no debe considerarse almacenamiento permanente.

## Exportación de evaluaciones

El panel del profesor incluye **⬇ Descargar evaluaciones**. Descarga un CSV compatible con Excel que reúne las evaluaciones grupales e individuales de la ronda actual y de las rondas anteriores archivadas.

Al pulsar **Reiniciar ronda**, la aplicación conserva antes de limpiar la ronda:
- número de ronda;
- empresa;
- participantes;
- evaluaciones grupales de inversionistas y emprendedores;
- evaluaciones individuales de cada participante.

El archivo se descarga como `shark-tank-aula-evaluaciones.csv` e incluye el puntaje total y el puntaje obtenido en cada criterio.


## Acceso separado profesor / participantes

La pantalla inicial ahora separa el acceso en dos rutas: **Panel del profesor** y **Emprendedores e inversionistas**. El panel docente no se habilita solo con seleccionar un rol: el servidor exige un código configurado en la variable de entorno `TEACHER_PIN`.

En Render, agrega `TEACHER_PIN` en **Environment Variables** y usa un código privado. No lo pongas en GitHub ni en el HTML/JavaScript del navegador. Las acciones de profesor (salas, etapas, temporizador, evaluaciones y nueva ronda) también se validan en el servidor.

La nueva sala galáctica utiliza la fotografía subida para esta versión y conserva la sala de madera sin modificar su geometría de pantalla.
