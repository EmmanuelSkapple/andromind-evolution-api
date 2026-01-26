# 🔒 Solución Rápida: Seguridad Redis - Digital Ocean

## ⚠️ Problema

Digital Ocean detectó que Redis está expuesto públicamente en el puerto 6379, lo cual es un **riesgo crítico de seguridad**.

## ✅ Solución Inmediata (5 minutos)

### Paso 1: Detener los contenedores
```bash
cd /ruta/a/tu/proyecto
docker-compose down
```

### Paso 2: Actualizar docker-compose.yaml

Ya hemos actualizado los archivos `docker-compose.yaml` para **NO exponer Redis públicamente**. 

**Cambio realizado:**
- ❌ **Antes:** `ports: - "6379:6379"` (expone Redis a internet)
- ✅ **Ahora:** Puerto 6379 NO está expuesto (solo accesible dentro de la red Docker)

### Paso 3: Actualizar .env

Si tu aplicación está en un contenedor Docker, actualiza la URI de Redis en tu archivo `.env`:

```env
# Cambiar de:
CACHE_REDIS_URI=redis://localhost:6379

# A (usando el nombre del servicio Docker):
CACHE_REDIS_URI=redis://evolution-redis:6379
```

**Nota:** Si Redis está en el mismo servidor pero fuera de Docker, mantén `localhost`.

### Paso 4: Reiniciar los contenedores
```bash
docker-compose up -d
```

### Paso 5: Verificar que Redis ya no sea accesible públicamente

```bash
# Desde tu servidor, esto DEBE fallar:
telnet TU_IP_PUBLICA 6379

# O usar el script de verificación:
./scripts/verify_redis_security.sh
```

## 🔍 Verificación Adicional

### Si Redis está instalado directamente en el servidor (no Docker):

1. **Editar configuración:**
   ```bash
   sudo nano /etc/redis/redis.conf
   ```

2. **Buscar y cambiar:**
   ```conf
   # De:
   bind 0.0.0.0
   
   # A:
   bind 127.0.0.1
   ```

3. **Reiniciar Redis:**
   ```bash
   sudo systemctl restart redis
   ```

### Configurar Firewall (Recomendado):

```bash
# Instalar UFW si no está instalado
sudo apt update
sudo apt install ufw -y

# Bloquear puerto 6379
sudo ufw deny 6379/tcp

# Habilitar firewall
sudo ufw enable

# Verificar
sudo ufw status
```

## 📋 Checklist Post-Implementación

- [ ] Contenedores reiniciados
- [ ] `.env` actualizado con la URI correcta
- [ ] Verificación de acceso externo realizada (debe fallar)
- [ ] Verificación de acceso local realizada (debe funcionar)
- [ ] Firewall configurado (opcional pero recomendado)

## 🆘 Si algo no funciona

1. **La aplicación no puede conectarse a Redis:**
   - Verifica que el contenedor `evolution-api` esté en la misma red Docker que `evolution-redis`
   - Verifica que la URI en `.env` use el nombre correcto del servicio: `evolution-redis`
   - Revisa los logs: `docker logs evolution-redis` y `docker logs evolution-api`

2. **Necesitas acceso desde el host para debugging:**
   - Puedes exponer Redis solo a localhost temporalmente:
     ```yaml
     ports:
       - "127.0.0.1:6379:6379"
     ```
   - Luego usa: `redis-cli -h localhost -p 6379`

## 📚 Documentación Completa

Para más detalles y opciones avanzadas, consulta: `REDIS_SECURITY.md`
