# Qué grabar y fotografiar para probar la inteligencia artificial (peces y plantas)

**Proyecto:** Cultivo de tilapia y mangle rojo con IoT
**Para qué sirve esto:** Aquí decimos qué videos e imágenes necesitamos para comprobar que la IA funciona bien antes de usarla de verdad.
**Qué cubre:** la IA de peces (cámara que cuenta y observa peces) y la IA de plantas (cámara que mira la salud del mangle rojo).

> El proyecto todavía no tiene videos ni fotos guardados. Esta es la lista de lo que el equipo debe grabar para poder hacer las pruebas.

---

## 1. Videos de los peces

La cámara usa un modelo llamado YOLOv11s (un modelo de visión ya entrenado) y otro programa que sigue a cada pez. Cuenta peces y mira si están activos o quietos.

### Cómo grabar
- **Formato:** un video normal `.mp4`. También puede ser una cámara conectada directo.
- **Calidad:** que se vea nítido, mejor si es panorámica amplia. El sistema reduce el tamaño solo, así que grabar en buena calidad ayuda.
- **Duración:** cada video de **5 a 10 minutos** (así la IA tiene tiempo de observar el comportamiento).
- **Cámara:** fija mirando la pecera, enfocada, sin mucho reflejo ni burbujas que tapen.

### Qué tipos de videos necesitamos
Queremos videos en estas situaciones (repetir ayuda a que las pruebas sean mejores):

| Situación | Qué debe verse en el video |
|---|---|
| Luz normal del día | Peces nadando con tranquilidad |
| Luz normal, muchos peces | La pecera llena, peces juntos |
| **Luz infrarroja (de noche)** | Peces con la luz especial de noche |
| **Agua turbia** (muy sucia/verdosa) | Peces en agua que no se ve clara |
| **Peces en la superficie** | Peces subiendo a la superficie a respirar |
| Peces muy quietos | Peces que apenas se mueven |

> Lo ideal: **7 a 14 videos**, de 5 a 10 minutos cada uno.

### Qué anotar junto con cada video
Para saber si la IA acierta, necesitamos que alguien apunte la "verdad":
- **Cuántos peces hay** en algunos momentos del video (para comparar con lo que dice la IA).
- **Cómo se comportan** (activos, tranquilos o quietos; si suben a la superficie).
- Si se puede, apuntar al mismo tiempo **los sensores** (oxígeno, temperatura, pH) para comparar.

### Lo que la IA todavía no sabe hacer
Hoy la cámara **no** distingue la especie, el tamaño ni si el pez está enfermo de verdad. Solo cuenta y ve el movimiento. Para eso habría que entrenarla con más fotos nuevas.

---

## 2. Fotos de las plantas (mangle rojo)

La cámara de plantas divide la hoja verde, clasifica la salud en 4 estados y estima cuánto ha crecido.

### Cómo fotografiar
- **Foto, no video.** Una imagen por planta.
- **Vista de arriba** (cámara fija encima de la bandeja), siempre a la misma distancia.
- **Luz blanca normal**, sin sombras fuertes.
- Buena resolución (que se vea bien la hoja).

### Qué fotos necesitamos (del mangle rojo)
| Estado de la planta | Cuántas fotos |
|---|---|
| Sana (verde, sin manchas) | 40 |
| Estrés (marchita un poco) | 30 |
| Enferma (manchas o necrosis) | 30 |
| Falta de nutrientes (amarilla) | 30 |
| Creciendo (plántula a grande) | 10 a 15 de cada etapa |

> Mínimo recomendado: **unas 160 fotos** bien repartidas. También sirven fotos del ají dulce (usado en la primera parte del proyecto) para comprobar que la IA generaliza.

### Calibración (para medir el tamaño de la hoja)
- Poner en cada foto un **objeto de tamaño conocido** (por ejemplo, una cartulina de 8.56 cm). Así la IA puede convertir píxeles a centímetros reales.
- Anotar el ancho real de ese objeto para que el sistema lo use.

### Qué anotar
- El estado real de cada planta (para comparar con lo que diga la IA).
- Si se puede, medir de verdad el tamaño de algunas hojas.

---

## 3. Resumen de lo que deben entregar
- [ ] 7 a 14 videos de peces (luz normal / noche / turbio, con pocos y muchos peces, activos y quietos) + anotar cuántos peces hay y cómo se comportan.
- [ ] Apuntar los sensores (oxígeno, temperatura, pH) al mismo tiempo que los videos.
- [ ] Unas 160 fotos de mangle rojo (4 estados + crecimiento) + fotos del ají dulce.
- [ ] Objeto de medida conocido en las fotos de plantas.
- [ ] Anotar el estado real de cada planta.

Con todo esto podemos correr las pruebas y llenar el reporte de avances.
