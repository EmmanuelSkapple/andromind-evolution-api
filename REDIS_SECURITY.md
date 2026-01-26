# Guía de Seguridad para Redis - Evolution API

## ⚠️ Problema de Seguridad Detectado

Digital Ocean ha detectado que tu instancia de Redis está expuesta públicamente en el puerto 6379, lo cual representa un **riesgo crítico de seguridad**.

## 🔒 Soluciones Recomendadas

### Opción 1: No Exponer Redis Públicamente (Recomendado para Docker)

Si Redis solo necesita ser accedido desde otros contenedores Docker en la misma red, **NO expongas el puerto al host**.

#### Para Docker Compose:

**Antes (INSEGURO):**
```yaml
ports:
  - "6379:6379"  # Expone Redis públicamente a internet
```

**Después (SEGURO - Recomendado):**
```yaml
# Eliminar completamente la sección ports
# Redis será accesible solo dentro de la red Docker 'evolution-network'
# Los contenedores se conectan usando: redis://evolution-redis:6379
```

**Si necesitas acceso desde el host para debugging (opcional):**
```yaml
ports:
  - "127.0.0.1:6379:6379"  # Solo accesible desde localhost del servidor
```

**Importante:** Si usas esta opción, actualiza tu `.env`:
- **Desde contenedor Docker:** `CACHE_REDIS_URI=redis://evolution-redis:6379`
- **Desde host (debugging):** `CACHE_REDIS_URI=redis://localhost:6379`

### Opción 2: Configurar Autenticación en Redis

Si necesitas acceso externo (no recomendado), configura autenticación:

1. **Crear un archivo de configuración Redis con contraseña:**

```bash
# Crear directorio para configuración
mkdir -p /etc/redis

# Crear archivo de configuración
cat > /etc/redis/redis.conf << EOF
# Escuchar solo en localhost
bind 127.0.0.1

# Puerto
port 6379

# Contraseña (cambiar por una contraseña segura)
requirepass TU_CONTRASEÑA_SEGURA_AQUI

# Deshabilitar comandos peligrosos
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG ""
rename-command EVAL ""
rename-command DEBUG ""

# Persistencia
appendonly yes
EOF
```

2. **Actualizar docker-compose.yaml para usar la configuración:**

```yaml
evolution-redis:
  container_name: evolution-redis
  image: redis:7-alpine
  restart: always
  networks:
    - evolution-network
  command: >
    redis-server /etc/redis/redis.conf
  volumes:
    - evolution_redis_data:/data
    - ./redis.conf:/etc/redis/redis.conf:ro
  ports:
    - "127.0.0.1:6379:6379"  # Solo localhost
```

3. **Actualizar la URI de conexión en .env:**

```env
CACHE_REDIS_URI=redis://:TU_CONTRASEÑA_SEGURA_AQUI@localhost:6379
```

### Opción 3: Configurar Firewall (UFW)

Si Redis debe estar en el servidor directamente (no en Docker):

```bash
# Instalar UFW si no está instalado
sudo apt update
sudo apt install ufw -y

# Permitir solo conexiones SSH
sudo ufw allow 22/tcp

# Permitir solo el puerto de la API (si es necesario)
sudo ufw allow 8080/tcp

# Bloquear Redis desde el exterior
sudo ufw deny 6379/tcp

# Habilitar firewall
sudo ufw enable

# Verificar estado
sudo ufw status
```

### Opción 4: Configurar Redis directamente en el servidor

Si Redis está instalado directamente en el servidor (no en Docker):

1. **Editar configuración de Redis:**

```bash
sudo nano /etc/redis/redis.conf
```

2. **Buscar y modificar estas líneas:**

```conf
# Cambiar de:
bind 0.0.0.0

# A:
bind 127.0.0.1

# Agregar contraseña:
requirepass TU_CONTRASEÑA_SEGURA_AQUI

# Deshabilitar comandos peligrosos:
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG ""
```

3. **Reiniciar Redis:**

```bash
sudo systemctl restart redis
sudo systemctl status redis
```

## 🚀 Implementación Rápida (Recomendada)

Para Evolution API, la **Opción 1** es la más segura y simple:

1. **Actualizar docker-compose.yaml** para eliminar la exposición del puerto 6379
2. **Actualizar .env** para usar el nombre del servicio Docker: `redis://evolution-redis:6379`
3. **Reiniciar los contenedores:**
   ```bash
   docker-compose down
   docker-compose up -d
   ```
4. **Verificar que Redis no sea accesible públicamente:**
   ```bash
   telnet TU_IP_PUBLICA 6379  # Debe fallar
   ```

## ✅ Verificación Post-Implementación

Después de aplicar los cambios, verifica que Redis ya no sea accesible públicamente:

```bash
# Desde otra máquina o servicio externo, esto DEBE fallar:
telnet TU_IP_PUBLICA 6379

# Desde el servidor local, esto DEBE funcionar:
telnet localhost 6379
```

## 📋 Checklist de Seguridad

- [ ] Redis solo escucha en 127.0.0.1 (localhost)
- [ ] Puerto 6379 no está expuesto públicamente
- [ ] Firewall configurado para bloquear acceso externo
- [ ] Contraseña configurada si es necesario
- [ ] Comandos peligrosos deshabilitados
- [ ] Verificación de acceso externo realizada

## 🔍 Monitoreo Continuo

- Revisa regularmente los logs de Redis: `docker logs evolution-redis`
- Monitorea intentos de conexión fallidos
- Considera usar herramientas de monitoreo como RedisInsight

## 📚 Recursos Adicionales

- [Redis Security Documentation](https://redis.io/docs/management/security/)
- [Digital Ocean Redis Security Guide](https://www.digitalocean.com/community/tutorials/how-to-secure-your-redis-installation-on-ubuntu-18-04)
