# Shark Tank Aula v4

Versión de aula con registro individual de participantes y panel docente de evaluación.

## Novedades
- Registro individual de hasta 5 inversionistas y 5 emprendedores.
- Identificación persistente durante la ronda mediante el socket de cada participante.
- El primer emprendedor configura la empresa; los siguientes se incorporan al mismo equipo.
- Panel del profesor con listado de participantes, roles, capital y estilo del inversionista.
- Rúbrica grupal de 100 puntos para inversionistas y emprendedores.
- Rúbrica individual de 100 puntos para cada participante.
- Selección por descriptor: Excelente (100 %), Adecuado (75 %) e Insuficiente (50 %).
- Cálculo automático del puntaje y guardado de la evaluación en la ronda.
- Se conserva la dinámica de ofertas, negociación, temporizador, salas y veredicto.

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
