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

La aplicación usa memoria de servidor para una ronda de clase. Un reinicio del servidor borra los registros de esa ronda.
